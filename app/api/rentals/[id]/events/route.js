import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';

const ONE_HOUR_MS = 60 * 60 * 1000;

export async function GET(req, { params }) {
  const supabase = supabaseServer();
  const { data: events, error } = await supabase
    .from('rental_events')
    .select('*, profiles(full_name)')
    .eq('rental_id', params.id)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ events });
}

export async function POST(req, { params }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: rental } = await supabase.from('rentals').select('*, listings(*)').eq('id', params.id).single();
  if (!rental) return NextResponse.json({ error: 'Rental not found' }, { status: 404 });

  const isOwner = rental.owner_id === user.id;
  const isRenter = rental.renter_id === user.id;
  if (!isOwner && !isRenter) return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
  const role = isOwner ? 'owner' : 'renter';

  const body = await req.json();
  const { kind } = body;

  // ---- plain chat message: always allowed ----
  if (kind === 'message') {
    if (!body.text?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: body.text.trim() } })
      .select().single();
    return NextResponse.json({ event: data });
  }

  // ---- upgrade an inquiry-only thread into a pending booking request ----
  if (kind === 'request_to_rent') {
    if (rental.stage !== 'inquiry') return NextResponse.json({ error: 'This thread is already a booking' }, { status: 400 });
    if (!isRenter) return NextResponse.json({ error: 'Only the renter can request to book' }, { status: 403 });
    if (!body.start_date || !body.end_date) return NextResponse.json({ error: 'Pick a start and end date' }, { status: 400 });
    if (body.end_date < body.start_date) return NextResponse.json({ error: 'End date is before the start date' }, { status: 400 });

    const { data: existing } = await supabase
      .from('rentals')
      .select('start_date, end_date, stage')
      .eq('listing_id', rental.listing_id)
      .in('stage', ['pending', 'booked', 'out', 'return']);
    const conflict = (existing || []).some(r => r.start_date && r.end_date && body.start_date <= r.end_date && body.end_date >= r.start_date);
    if (conflict) return NextResponse.json({ error: 'Those dates overlap another booking on this item' }, { status: 400 });

    await supabase.from('rentals').update({ stage: 'pending', start_date: body.start_date, end_date: body.end_date }).eq('id', rental.id);
    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: `Requested to rent this for ${body.start_date} to ${body.end_date} — waiting on the owner's approval.` } })
      .select().single();
    return NextResponse.json({ event: data });
  }

  // ---- owner approves or declines a pending request ----
  if (kind === 'approve' || kind === 'decline') {
    if (rental.stage !== 'pending') return NextResponse.json({ error: 'Nothing pending to respond to' }, { status: 400 });
    if (!isOwner) return NextResponse.json({ error: 'Only the owner can approve or decline' }, { status: 403 });

    const newStage = kind === 'approve' ? 'booked' : 'declined';
    await supabase.from('rentals').update({ stage: newStage }).eq('id', rental.id);
    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: kind === 'approve' ? 'Approved — meet up and share the handoff code below when ready.' : 'Declined this request.' } })
      .select().single();
    return NextResponse.json({ event: data });
  }

  // ---- handoff code: renter enters the 4-digit code the owner shows them ----
  // The owner already photographed the item when listing it, so this single
  // matching action stands in for "both parties confirmed the handoff" —
  // it triggers payment immediately.
  if (kind === 'code_confirmed') {
    if (rental.stage !== 'booked') return NextResponse.json({ error: 'Wrong stage for a handoff code' }, { status: 400 });
    if (!isRenter) return NextResponse.json({ error: 'Only the renter enters the code' }, { status: 403 });
    if (body.code !== rental.qr_token) return NextResponse.json({ error: "That code doesn't match — check with the owner." }, { status: 400 });

    const now = new Date().toISOString();
    await supabase.from('rentals').update({ handoff_confirmed_at: now }).eq('id', rental.id);
    await supabase.from('rental_events').insert({ rental_id: rental.id, kind: 'code_confirmed', actor_id: user.id, payload: {} });

    await handleHandoffConfirmed(supabase, rental);
    return NextResponse.json({ ok: true });
  }

  // ---- renter's post-handoff damage-check photo, within a 1-hour window ----
  if (kind === 'photo' && body.phase === 'preexisting') {
    if (rental.stage !== 'out') return NextResponse.json({ error: 'Wrong stage for this photo' }, { status: 400 });
    if (!isRenter) return NextResponse.json({ error: 'Only the renter documents pre-existing damage' }, { status: 403 });
    if (!rental.handoff_confirmed_at || Date.now() - new Date(rental.handoff_confirmed_at).getTime() > ONE_HOUR_MS) {
      return NextResponse.json({ error: 'The 1-hour window to document damage has closed' }, { status: 400 });
    }
    if (!body.side || !body.url) return NextResponse.json({ error: 'Missing photo side or url' }, { status: 400 });

    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'photo', actor_id: user.id, payload: { phase: 'preexisting', side: body.side, url: body.url } })
      .select().single();
    return NextResponse.json({ event: data });
  }

  // ---- condition photo at return ----
  if (kind === 'photo' && body.phase === 'after') {
    if (rental.stage !== 'return') return NextResponse.json({ error: 'Wrong stage for this photo' }, { status: 400 });
    if (!body.side || !body.url) return NextResponse.json({ error: 'Missing photo side or url' }, { status: 400 });

    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'photo', actor_id: user.id, payload: { phase: 'after', side: body.side, url: body.url } })
      .select().single();
    return NextResponse.json({ event: data });
  }

  // ---- dual confirm at return: both owner and renter must tap this ----
  if (kind === 'confirm') {
    if (rental.stage !== 'return') return NextResponse.json({ error: 'Wrong stage to confirm' }, { status: 400 });

    const { data: existing } = await supabase.from('rental_events')
      .select('*').eq('rental_id', rental.id).eq('kind', 'confirm');
    const alreadyConfirmed = existing?.some(e => e.payload?.phase === 'return' && e.payload?.role === role);
    if (alreadyConfirmed) return NextResponse.json({ error: 'Already confirmed' }, { status: 400 });

    await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'confirm', actor_id: user.id, payload: { phase: 'return', role } });

    const otherConfirmed = existing?.some(e => e.payload?.phase === 'return' && e.payload?.role !== role);
    if (!otherConfirmed) return NextResponse.json({ ok: true, bothConfirmed: false });

    await handleReturnConfirmed(supabase, rental);
    return NextResponse.json({ ok: true, bothConfirmed: true });
  }

  // ---- dispute: either party can flag a mismatch instead of confirming return ----
  if (kind === 'dispute') {
    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'dispute', actor_id: user.id, payload: { reason: body.reason || '' } })
      .select().single();
    await supabase.from('rentals').update({ stage: 'disputed' }).eq('id', rental.id);
    return NextResponse.json({ event: data });
  }

  return NextResponse.json({ error: 'Unknown event kind' }, { status: 400 });
}

// Handoff code matched: charge the rental price to the renter,
// authorize (but don't capture) the deposit hold, move stage to 'out'.
async function handleHandoffConfirmed(supabase, rental) {
  const { data: renterProfile } = await supabase.from('profiles').select('*').eq('id', rental.renter_id).single();
  const { data: ownerProfile } = await supabase.from('profiles').select('*').eq('id', rental.owner_id).single();
  const listing = rental.listings;

  if (!renterProfile?.stripe_customer_id || !renterProfile?.default_payment_method_id) {
    await supabase.from('rental_events').insert({
      rental_id: rental.id, kind: 'message', actor_id: null,
      payload: { text: 'Add a payment method to complete this handoff.', system: true },
    });
    await supabase.from('rentals').update({ stage: 'out' }).eq('id', rental.id);
    return;
  }

  const rentalIntent = await stripe.paymentIntents.create({
    amount: listing.price_cents,
    currency: 'usd',
    customer: renterProfile.stripe_customer_id,
    payment_method: renterProfile.default_payment_method_id,
    off_session: true,
    confirm: true,
    transfer_data: ownerProfile?.stripe_account_id ? { destination: ownerProfile.stripe_account_id } : undefined,
    application_fee_amount: Math.round(listing.price_cents * 0.15),
  });

  const depositIntent = await stripe.paymentIntents.create({
    amount: listing.deposit_cents,
    currency: 'usd',
    customer: renterProfile.stripe_customer_id,
    payment_method: renterProfile.default_payment_method_id,
    off_session: true,
    confirm: true,
    capture_method: 'manual',
  });

  await supabase.from('rentals').update({
    stage: 'out',
    rental_payment_intent_id: rentalIntent.id,
    deposit_payment_intent_id: depositIntent.id,
  }).eq('id', rental.id);

  await supabase.from('rental_events').insert({
    rental_id: rental.id, kind: 'payment_released', actor_id: null, payload: {},
  });
}

// Both sides confirmed return: release (cancel) the deposit authorization
// so the hold drops off the renter's card, move stage to 'settled'.
async function handleReturnConfirmed(supabase, rental) {
  if (rental.deposit_payment_intent_id) {
    await stripe.paymentIntents.cancel(rental.deposit_payment_intent_id).catch(() => {});
  }
  await supabase.from('rentals').update({ stage: 'settled' }).eq('id', rental.id);
  await supabase.from('rental_events').insert({
    rental_id: rental.id, kind: 'deposit_refunded', actor_id: null, payload: {},
  });
}
