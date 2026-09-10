import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { rental_id, rating, comment } = await req.json();
  if (!rental_id || !rating) return NextResponse.json({ error: 'Missing rental or rating' }, { status: 400 });

  const { data: rental } = await supabase.from('rentals').select('*').eq('id', rental_id).single();
  if (!rental) return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
  if (!['settled', 'disputed', 'no_show'].includes(rental.stage)) {
    return NextResponse.json({ error: 'This rental is not finished yet' }, { status: 400 });
  }

  const isOwner = rental.owner_id === user.id;
  const isRenter = rental.renter_id === user.id;
  if (!isOwner && !isRenter) return NextResponse.json({ error: 'Not a participant' }, { status: 403 });

  const reviewee_id = isOwner ? rental.renter_id : rental.owner_id;

  const { data, error } = await supabase
    .from('reviews')
    .insert({ rental_id, reviewer_id: user.id, reviewee_id, rating, comment: comment || null, reviewer_role: isOwner ? 'owner' : 'renter' })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ review: data });
}

// owner_response: the person being reviewed can respond once, publicly under the review
export async function PATCH(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { review_id, response } = await req.json();
  const { data: review } = await supabase.from('reviews').select('*').eq('id', review_id).single();
  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  if (review.reviewee_id !== user.id) return NextResponse.json({ error: 'Only the reviewed person can respond' }, { status: 403 });
  if (review.owner_response) return NextResponse.json({ error: 'Already responded' }, { status: 400 });

  const { data, error } = await supabase.from('reviews').update({ owner_response: response }).eq('id', review_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ review: data });
}
