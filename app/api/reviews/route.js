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
  if (rental.stage !== 'settled') return NextResponse.json({ error: 'Can only review a settled rental' }, { status: 400 });

  const isOwner = rental.owner_id === user.id;
  const isRenter = rental.renter_id === user.id;
  if (!isOwner && !isRenter) return NextResponse.json({ error: 'Not a participant' }, { status: 403 });

  const reviewee_id = isOwner ? rental.renter_id : rental.owner_id;

  const { data, error } = await supabase
    .from('reviews')
    .insert({ rental_id, reviewer_id: user.id, reviewee_id, rating, comment: comment || null })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ review: data });
}
