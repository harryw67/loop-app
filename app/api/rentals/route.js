import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import crypto from 'crypto';
import { formatDateShort } from '@/lib/dates';

export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data, error } = await supabase
    .from('rentals')
    .select('*, listings(name, photo_url, price_cents, deposit_cents), owner:owner_id(full_name), renter:renter_id(full_name)')
    .or(`owner_id.eq.${user.id},renter_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rentals: data });
}

// stages that mean an item is actually spoken for during its date range
const BLOCKING_STAGES = ['pending', 'booked', 'handoff', 'out', 'return'];

async function hasDateConflict(supabase, listing_id, start_date, end_date) {
  const { data: existing } = await supabase
    .from('rentals')
    .select('start_date, end_date, stage')
    .eq('listing_id', listing_id)
    .in('stage', BLOCKING_STAGES);

  return (existing || []).some(r => {
    if (!r.start_date || !r.end_date) return false;
    return start_date <= r.end_date && end_date >= r.start_date;
  });
}

export async function POST(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { listing_id, mode, start_date, end_date } = await req.json();
  const { data: listing, error: listingErr } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listing_id)
    .single();
  if (listingErr || !listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  if (listing.owner_id === user.id) return NextResponse.json({ error: "You can't rent your own listing" }, { status: 400 });

  if (mode !== 'inquiry') {
    if (!start_date || !end_date) return NextResponse.json({ error: 'Pick a start and end date' }, { status: 400 });
    if (end_date < start_date) return NextResponse.json({ error: 'End date is before the start date' }, { status: 400 });
    if (await hasDateConflict(supabase, listing_id, start_date, end_date)) {
      return NextResponse.json({ error: 'Those dates overlap another booking on this item' }, { status: 400 });
    }
  }

  const qr_token = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit handoff code
  const stage = mode === 'inquiry' ? 'inquiry' : 'pending';

  const { data: rental, error } = await supabase
    .from('rentals')
    .insert({
      listing_id,
      owner_id: listing.owner_id,
      renter_id: user.id,
      stage,
      qr_token,
      start_date: mode === 'inquiry' ? null : start_date,
      end_date: mode === 'inquiry' ? null : end_date,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from('rental_events').insert({
    rental_id: rental.id,
    kind: 'message',
    actor_id: user.id,
    payload: {
      text: mode === 'inquiry'
        ? 'Hey! Had a question about this before booking.'
        : `Requested to rent this for ${formatDateShort(start_date)} to ${formatDateShort(end_date)} — waiting on the owner's approval.`,
    },
  });

  return NextResponse.json({ rental });
}
