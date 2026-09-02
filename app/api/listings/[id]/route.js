import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function PATCH(req, { params }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: listing } = await supabase.from('listings').select('owner_id').eq('id', params.id).single();
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (listing.owner_id !== user.id) return NextResponse.json({ error: 'Not your listing' }, { status: 403 });

  const body = await req.json();
  const { name, category, size, price, deposit, description, photos, distance } = body;
  const photoList = Array.isArray(photos) ? photos.filter(Boolean) : undefined;

  const update = {};
  if (name) update.name = name;
  if (category) update.category = category;
  if (size) update.size = size;
  if (price) update.price_cents = Math.round(parseFloat(price) * 100);
  if (deposit) update.deposit_cents = Math.round(parseFloat(deposit) * 100);
  if (description) update.description = description;
  if (distance !== undefined) update.distance_miles = distance;
  if (photoList) { update.photos = photoList; update.photo_url = photoList[0] || null; }

  const { data, error } = await supabase.from('listings').update(update).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ listing: data });
}

export async function DELETE(req, { params }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: listing } = await supabase.from('listings').select('owner_id').eq('id', params.id).single();
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (listing.owner_id !== user.id) return NextResponse.json({ error: 'Not your listing' }, { status: 403 });

  // soft delete — keeps history intact for any existing rentals referencing it
  const { error } = await supabase.from('listings').update({ active: false }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
