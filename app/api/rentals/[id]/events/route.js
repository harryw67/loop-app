import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';
import { formatDateShort } from '@/lib/dates';
import { containsFlaggedContent } from '@/lib/contentFlag';

const ONE_HOUR_MS = 60 * 60 * 1000;
const REQUEST_EXPIRY_HOURS = 36;
const NO_SHOW_APPEAL_HOURS = 48;

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

async function checkBlocked(supabase, aId, bId) {
  const { data } = await supabase.from('blocks').select('id')
    .or(`and(blocker_id.eq.${aId},blocked_id.eq.${bId}),and(blocker_id.eq.${bId},blocked_id.eq.${aId})`)
    .maybeSingle();
  return !!data;
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

  // ---- plain chat message: allowed unless one side has blocked the other ----
  if (kind === 'message') {
    if (!body.text?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 });
    if (await checkBlocked(supabase, rental.owner_id, rental.renter_id)) {
      return NextResponse.json({ error: 'This conversation is no longer available' }, { status: 403 });
    }

    // lightweight rate limit: 20 messages/hour, tighter (5/hour) for accounts
    // less than 48h old, since that's when spam signups do the most damage
    const { data: myProfile } = await supabase.from('profiles').select('created_at').eq('id', user.id).single();
    const isNewAccount = myProfile && (Date.now() - new Date(myProfile.created_at).getTime()) < 48 * ONE_HOUR_MS;
    const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS).toISOString();
    const { count } = await supabase.from('rental_events').select('id', { count: 'exact', head: true })
      .eq('actor_id', user.id).eq('kind', 'message').gte('created_at', oneHourAgo);
    if (count >= (isNewAccount ? 5 : 20)) {
      return NextResponse.json({ error: "You're sending messages too quickly — try again in a bit." }, { status: 429 });
    }

    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: body.text.trim() } })
      .select().single();

    if (containsFlaggedContent(body.text)) {
      const admin = supabaseAdmin();
      await admin.from('reports').insert({
        reporter_id: user.id, reported_user_id: user.id, rental_id: rental.id,
        reason: `AUTO-FLAG: message in rental ${rental.id} contains potentially prohibited content — needs review.`,
      });
    }

    return NextResponse.json({ event: data });
  }

  // ---- upgrade an inquiry-only thread into a pending booking request ----
  if (kind === 'request_to_rent') {
    if (rental.stage !== 'inquiry') return NextResponse.json({ error: 'This thread is already a booking' }, { status: 400 });
    if (!isRenter) return NextResponse.json({ error: 'Only the renter can request to book' }, { status: 403 });
    if (await checkBlocked(supabase, rental.owner_id, rental.renter_id)) {
      return NextResponse.json({ error: 'Unable to book this listing' }, { status: 403 });
    }
    if (!body.start_date || !body.end_date) return NextResponse.json({ error: 'Pick a start and end date' }, { status: 400 });
    if (body.end_date < body.start_date) return NextResponse.json({ error: 'End date is before the start date' }, { status: 400 });

    const days = Math.round((new Date(body.end_date) - new Date(body.start_date)) / 86400000) + 1;
    const listing = rental.listings;
    if (listing.min_days && days < listing.min_days) return NextResponse.json({ error: `This item needs at least ${listing.min_days} day(s).` }, { status: 400 });
    if (listing.max_days && days > listing.max_days) return NextResponse.json({ error: `This item can only be rented up to ${listing.max_days} day(s) at a time.` }, { status: 400 });

    const { data: existing } = await supabase
      .from('rentals')
      .select('start_date, end_date, stage')
      .eq('listing_id', rental.listing_id)
      .in('stage', ['pending', 'booked', 'out', 'return']);
    const conflict = (existing || []).some(r => r.start_date && r.end_date && body.start_date <= r.end_date && body.end_date >= r.start_date);
    if (conflict) return NextResponse.json({ error: 'Those dates overlap another booking on this item' }, { status: 400 });

    const expires_at = new Date(Date.now() + REQUEST_EXPIRY_HOURS * ONE_HOUR_MS).toISOString();
    await supabase.from('rentals').update({ stage: 'pending', start_date: body.start_date, end_date: body.end_date, expires_at }).eq('id', rental.id);
    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: `Requested to rent this for ${formatDateShort(body.start_date)} to ${formatDateShort(body.end_date)} — waiting on the owner's approval.` } })
      .select().single();
    return NextResponse.json({ event: data });
  }

  // ---- owner approves or declines a pending request ----
  if (kind === 'approve' || kind === 'decline') {
    if (rental.stage !== 'pending') return NextResponse.json({ error: 'Nothing pending to respond to' }, { status: 400 });
    if (!isOwner) return NextResponse.json({ error: 'Only the owner can approve or decline' }, { status: 403 });

    if (kind === 'decline') {
      await supabase.from('rentals').update({ stage: 'declined' }).eq('id', rental.id);
      const { data } = await supabase.from('rental_events')
        .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: 'Declined this request.' } })
        .select().single();
      return NextResponse.json({ event: data });
    }

    await supabase.from('rentals').update({ stage: 'booked', expires_at: null }).eq('id', rental.id);
    await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: 'Approved — meet up and share the handoff code below when ready.' } });

    const { data: ownerProfile } = await supabase.from('profiles').select('stripe_account_id').eq('id', rental.owner_id).single();

    let held = null;
    try {
      held = await createPaymentHolds(supabase, rental);
    } catch (err) {
      console.error('approve payment hold error:', err);
    }
    if (held) {
      await supabase.from('rental_events').insert({ rental_id: rental.id, kind: 'payment_held', actor_id: null, payload: {} });
      if (!ownerProfile?.stripe_account_id) {
        await supabase.from('rental_events').insert({
          rental_id: rental.id, kind: 'message', actor_id: null,
          payload: { text: "Note: payout isn't automated yet since a payout account isn't connected — this will need to be sent manually for now.", system: true },
        });
      }
    } else {
      await supabase.from('rental_events').insert({
        rental_id: rental.id, kind: 'message', actor_id: null,
        payload: { text: "Payment can't be held yet — the renter needs to add a card.", system: true },
      });
    }

    // auto-decline any other pending requests on this same listing that overlap these dates
    const { data: overlapping } = await supabase.from('rentals').select('*')
      .eq('listing_id', rental.listing_id).eq('stage', 'pending').neq('id', rental.id);
    for (const other of overlapping || []) {
      if (other.start_date && other.end_date && rental.start_date <= other.end_date && rental.end_date >= other.start_date) {
        await supabase.from('rentals').update({ stage: 'declined' }).eq('id', other.id);
        await supabase.from('rental_events').insert({
          rental_id: other.id, kind: 'message', actor_id: null,
          payload: { text: 'This item got booked by someone else for those dates.', system: true },
        });
      }
    }

    return NextResponse.json({ ok: true });
  }

  // ---- cancel: free before approval, voids holds if already approved ----
  if (kind === 'cancel') {
    if (!['pending', 'booked'].includes(rental.stage)) {
      return NextResponse.json({ error: 'This can only be cancelled before the handoff happens' }, { status: 400 });
    }
    const wasApproved = rental.stage === 'booked';

    if (rental.rental_payment_intent_id) await stripe.paymentIntents.cancel(rental.rental_payment_intent_id).catch(() => {});
    if (rental.deposit_payment_intent_id) await stripe.paymentIntents.cancel(rental.deposit_payment_intent_id).catch(() => {});

    await supabase.from('rentals').update({ stage: 'cancelled', cancelled_by: role, cancelled_at: new Date().toISOString() }).eq('id', rental.id);

    // only count cancellations that happen after the owner already approved —
    // backing out before that is free and doesn't affect anyone's record
    if (wasApproved) {
      const { data: p } = await supabase.from('profiles').select('cancellation_count').eq('id', user.id).single();
      await supabase.from('profiles').update({ cancellation_count: (p?.cancellation_count || 0) + 1 }).eq('id', user.id);
    }

    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: `${role === 'owner' ? 'Owner' : 'Renter'} cancelled this booking.` } })
      .select().single();
    return NextResponse.json({ event: data });
  }

  // ---- handoff code: renter enters the 4-digit code the owner shows them ----
  if (kind === 'code_confirmed') {
    if (rental.stage !== 'booked') return NextResponse.json({ error: 'Wrong stage for a handoff code' }, { status: 400 });
    if (!isRenter) return NextResponse.json({ error: 'Only the renter enters the code' }, { status: 403 });
    if (body.code !== rental.qr_token) return NextResponse.json({ error: "That code doesn't match — check with the owner." }, { status: 400 });

    let rentalIntentId = rental.rental_payment_intent_id;
    try {
      if (!rentalIntentId) {
        const held = await createPaymentHolds(supabase, rental);
        if (!held) return NextResponse.json({ error: "Add a payment method to complete this handoff." }, { status: 400 });
        rentalIntentId = held.rentalIntentId;
      }

      await stripe.paymentIntents.capture(rentalIntentId);
    } catch (err) {
      console.error('code_confirmed payment error:', err);
      return NextResponse.json({ error: `Payment failed: ${err.message || 'the card may have been declined or the payment method is invalid.'}` }, { status: 400 });
    }

    await creditReferrerIfEligible(supabase, rental).catch(err => console.error('referral credit error:', err));

    const now = new Date().toISOString();
    await supabase.from('rentals').update({ stage: 'out', handoff_confirmed_at: now }).eq('id', rental.id);
    await supabase.from('rental_events').insert({ rental_id: rental.id, kind: 'code_confirmed', actor_id: user.id, payload: {} });
    await supabase.from('rental_events').insert({ rental_id: rental.id, kind: 'payment_released', actor_id: null, payload: {} });

    return NextResponse.json({ ok: true });
  }

  // ---- renter's post-handoff damage-check photo, within a 1-hour window ----
  // ---- renter starts the return process, whenever they're ready — no
  // fixed deadline, they just need to actually have the item back to the
  // owner around the same time in real life ----
  if (kind === 'start_return') {
    if (rental.stage !== 'out') return NextResponse.json({ error: 'Wrong stage to start a return' }, { status: 400 });
    if (!isRenter) return NextResponse.json({ error: 'Only the renter starts the return' }, { status: 403 });

    await supabase.from('rentals').update({ stage: 'return' }).eq('id', rental.id);
    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: "Ready to return this — let's do condition photos." } })
      .select().single();
    return NextResponse.json({ event: data });
  }

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

  // ---- "looks good" at return: both sides tapping this releases the deposit.
  // If the other side goes quiet, a 48h grace period auto-resolves it — but
  // only in the renter's favor if the owner was the one who said it looked
  // good. A flagged issue never auto-resolves in anyone's favor. ----
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

  // ---- report a no-show ----
  if (kind === 'report_no_show') {
    if (rental.stage !== 'booked') return NextResponse.json({ error: 'This only applies before the handoff happens' }, { status: 400 });
    const today = new Date().toISOString().slice(0, 10);
    if (rental.start_date && today < rental.start_date) return NextResponse.json({ error: "You can't report this until the rental date arrives" }, { status: 400 });

    if (rental.rental_payment_intent_id) await stripe.paymentIntents.cancel(rental.rental_payment_intent_id).catch(() => {});
    if (rental.deposit_payment_intent_id) await stripe.paymentIntents.cancel(rental.deposit_payment_intent_id).catch(() => {});

    const noShowUserId = isRenter ? rental.owner_id : rental.renter_id;
    const { data: p } = await supabase.from('profiles').select('no_show_count').eq('id', noShowUserId).single();
    await supabase.from('profiles').update({ no_show_count: (p?.no_show_count || 0) + 1 }).eq('id', noShowUserId);

    const dispute_deadline = new Date(Date.now() + NO_SHOW_APPEAL_HOURS * ONE_HOUR_MS).toISOString();
    await supabase.from('rentals').update({ stage: 'no_show', no_show_status: 'confirmed', no_show_dispute_deadline: dispute_deadline }).eq('id', rental.id);
    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'no_show', actor_id: user.id, payload: { reported: isRenter ? 'owner' : 'renter' } })
      .select().single();
    return NextResponse.json({ event: data });
  }

  // ---- the accused disputes a no-show report, within 48h ----
  // Immediately hides the strike from their public profile (decrements the
  // count) until an admin reviews it and either upholds or dismisses it.
  if (kind === 'dispute_no_show') {
    if (rental.stage !== 'no_show') return NextResponse.json({ error: 'No no-show report to dispute' }, { status: 400 });
    if (rental.no_show_status !== 'confirmed') return NextResponse.json({ error: 'Already under review or resolved' }, { status: 400 });
    if (!rental.no_show_dispute_deadline || new Date() > new Date(rental.no_show_dispute_deadline)) {
      return NextResponse.json({ error: 'The 48-hour window to dispute this has passed' }, { status: 400 });
    }
    // the accused is whichever role did NOT file the report
    const reportEvent = (await supabase.from('rental_events').select('*').eq('rental_id', rental.id).eq('kind', 'no_show').single()).data;
    const accusedRole = reportEvent?.payload?.reported;
    if (accusedRole !== role) return NextResponse.json({ error: 'Only the accused party can dispute this' }, { status: 403 });

    const accusedUserId = accusedRole === 'owner' ? rental.owner_id : rental.renter_id;
    const { data: p } = await supabase.from('profiles').select('no_show_count').eq('id', accusedUserId).single();
    await supabase.from('profiles').update({ no_show_count: Math.max(0, (p?.no_show_count || 1) - 1) }).eq('id', accusedUserId);

    await supabase.from('rentals').update({ no_show_status: 'under_review', no_show_dispute_reason: body.reason || '' }).eq('id', rental.id);
    const { data } = await supabase.from('rental_events')
      .insert({ rental_id: rental.id, kind: 'message', actor_id: user.id, payload: { text: `Disputed the no-show report: "${body.reason || ''}" — under review.` } })
      .select().single();
    return NextResponse.json({ event: data });
  }

  return NextResponse.json({ error: 'Unknown event kind' }, { status: 400 });
}

async function createPaymentHolds(supabase, rental) {
  const { data: renterProfile } = await supabase.from('profiles').select('*').eq('id', rental.renter_id).single();
  const { data: ownerProfile } = await supabase.from('profiles').select('*').eq('id', rental.owner_id).single();
  const listing = rental.listings;

  if (!renterProfile?.stripe_customer_id || !renterProfile?.default_payment_method_id) return null;

  // TEMPORARY: while Stripe Connect account creation is being sorted out,
  // proceed WITHOUT a connected-account transfer if the owner hasn't
  // connected one yet — the charge still happens (held on Loop's own
  // balance), it just isn't automatically split/transferred to the owner.
  // Real payouts to owners without a connected account need to be handled
  // manually until Connect is working end-to-end.
  const ownerConnected = !!ownerProfile?.stripe_account_id;

  const eligible = await referralEligible(supabase, renterProfile);
  const rentalChargeAmount = eligible ? Math.round(listing.price_cents * 0.95) : listing.price_cents;
  const applicationFee = eligible ? Math.round(listing.price_cents * 0.03) : Math.round(listing.price_cents * 0.15);

  const rentalIntent = await stripe.paymentIntents.create({
    amount: rentalChargeAmount,
    currency: 'usd',
    customer: renterProfile.stripe_customer_id,
    payment_method: renterProfile.default_payment_method_id,
    off_session: true,
    confirm: true,
    capture_method: 'manual',
    ...(ownerConnected ? { transfer_data: { destination: ownerProfile.stripe_account_id }, application_fee_amount: applicationFee } : {}),
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

  // record card fingerprint for referral-fraud signal detection
  try {
    const pm = await stripe.paymentMethods.retrieve(renterProfile.default_payment_method_id);
    if (pm?.card?.fingerprint) await supabase.from('profiles').update({ card_fingerprint: pm.card.fingerprint }).eq('id', renterProfile.id);
  } catch {}

  await supabase.from('rentals').update({
    rental_payment_intent_id: rentalIntent.id,
    deposit_payment_intent_id: depositIntent.id,
  }).eq('id', rental.id);

  return { rentalIntentId: rentalIntent.id, depositIntentId: depositIntent.id };
}

// Referral discount only applies to a renter's FIRST-ever completed rental —
// after that, normal pricing applies even though they're still "referred."
// This bounds the cost per referred user instead of discounting forever.
async function referralEligible(supabase, renterProfile) {
  if (!renterProfile.referred_by) return false;
  const { count } = await supabase.from('rentals').select('id', { count: 'exact', head: true })
    .eq('renter_id', renterProfile.id).in('stage', ['out', 'return', 'settled']);
  return (count || 0) === 0;
}

// Credits the referrer only once the rental is actually captured (real
// money moved), not at approval time — so a cancelled booking never
// generates a credit for something that didn't happen.
async function creditReferrerIfEligible(supabase, rental) {
  const { data: renterProfile } = await supabase.from('profiles').select('*').eq('id', rental.renter_id).single();
  if (!renterProfile?.referred_by) return;
  const eligible = await referralEligible(supabase, renterProfile);
  // referralEligible checks stage in ('out','return','settled') — by the time
  // this runs, this rental is about to move to 'out', so a 0-count here means
  // this is genuinely their first one
  if (!eligible) return;

  const { data: referrer } = await supabase.from('profiles').select('*').eq('referral_code', renterProfile.referred_by).maybeSingle();
  if (!referrer) return;

  const listing = rental.listings;
  const credit = Math.round(listing.price_cents * 0.05);
  const capped = Math.min((referrer.referral_credit_cents || 0) + credit, 5000); // $50 cap
  await supabase.from('profiles').update({ referral_credit_cents: capped, referral_credit_earned_at: new Date().toISOString() }).eq('id', referrer.id);

  // flag possible referral fraud (shared card between referrer and referred) for manual review
  if (referrer.card_fingerprint && renterProfile.card_fingerprint && referrer.card_fingerprint === renterProfile.card_fingerprint) {
    const admin = supabaseAdmin();
    await admin.from('reports').insert({
      reporter_id: renterProfile.id, reported_user_id: referrer.id, rental_id: rental.id,
      reason: 'AUTO-FLAG: referrer and referred user share the same card fingerprint — possible referral fraud.',
    });
  }
}

async function handleReturnConfirmed(supabase, rental) {
  if (rental.deposit_payment_intent_id) {
    await stripe.paymentIntents.cancel(rental.deposit_payment_intent_id).catch(() => {});
  }
  await supabase.from('rentals').update({ stage: 'settled' }).eq('id', rental.id);
  await supabase.from('rental_events').insert({
    rental_id: rental.id, kind: 'deposit_refunded', actor_id: null, payload: {},
  });
}
