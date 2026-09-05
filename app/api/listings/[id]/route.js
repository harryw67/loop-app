import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabaseServer';
import { containsFlaggedContent } from '@/lib/contentFlag';

export async function PATCH(req, { params }) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: listing } = await supabase.from('listings').select('owner_id').eq('id', params.id).single();
  if (!listing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (listing.owner_id !== user.id) return NextResponse.json({ error: 'Not your listing' }, { status: 403 });

  const body = await req.json();
  const { name, category, size, color, gender, price, deposit, description, photos, distance, care_instructions, lat, lng, min_days, max_days } = body;
  const photoList = Array.isArray(photos) ? photos.filter(Boolean) : undefined;

  const update = {};
  if (name) update.name = name;
  if (category) update.category = category;
  if (size) update.size = size;
  if (price) update.price_cents = Math.round(parseFloat(price) * 100);
  if (deposit) update.deposit_cents = Math.round(parseFloat(deposit) * 100);
  if (description) update.description = description;
  if (distance !== undefined) update.distance_miles = distance;
  if (care_instructions !== undefined) update.care_instructions = care_instructions;
  if (color !== undefined) update.color = color;
  if (gender !== undefined) update.gender = gender;
  if (min_days !== undefined) update.min_days = parseInt(min_days);
  if (max_days !== undefined) update.max_days = parseInt(max_days);
  if (lat !== undefined && lng !== undefined) { update.lat = lat; update.lng = lng; }
  if (photoList) { update.photos = photoList; update.photo_url = photoList[0] || null; }

  const { data, error } = await supabase.from('listings').update(update).eq('id', params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (containsFlaggedContent(update.name) || containsFlaggedContent(update.description)) {
    const admin = supabaseAdmin();
    await admin.from('reports').insert({
      reporter_id: user.id, reported_user_id: user.id,
      reason: `AUTO-FLAG: edited listing "${data.name}" (id: ${data.id}) contains potentially prohibited content — needs review.`,
    });
  }

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
