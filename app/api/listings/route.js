import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { distanceMiles } from '@/lib/location';

export async function GET(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { searchParams } = new URL(req.url);
  const maxPrice = searchParams.get('maxPrice');
  const sizes = searchParams.get('sizes');
  const categories = searchParams.get('categories');
  const maxDistance = searchParams.get('maxDistance');
  const search = searchParams.get('search');
  const colors = searchParams.get('colors');
  const myLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')) : null;
  const myLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')) : null;

  let query = supabase
    .from('listings')
    .select('*, profiles(full_name)')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (maxPrice) query = query.lte('price_cents', parseInt(maxPrice) * 100);
  if (sizes) query = query.in('size', sizes.split(','));
  if (categories) query = query.in('category', categories.split(','));
  if (search) query = query.ilike('name', `%${search}%`);
  if (colors) query = query.in('color', colors.split(','));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // filter out listings from anyone the current user has blocked
  let listings = data;
  if (user) {
    const { data: blocked } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id);
    const blockedIds = new Set((blocked || []).map(b => b.blocked_id));
    if (blockedIds.size) listings = listings.filter(l => !blockedIds.has(l.owner_id));
  }

  // if we know the requester's real location, compute real distance to each
  // listing that has one, filter by it, and sort nearest-first
  if (myLat != null && myLng != null) {
    listings = listings.map(l => ({
      ...l,
      distance_from_you: l.lat != null && l.lng != null ? distanceMiles(myLat, myLng, l.lat, l.lng) : null,
    }));
    if (maxDistance) {
      const max = parseFloat(maxDistance);
      listings = listings.filter(l => l.distance_from_you == null || l.distance_from_you <= max);
    }
    listings.sort((a, b) => {
      if (a.distance_from_you == null) return 1;
      if (b.distance_from_you == null) return -1;
      return a.distance_from_you - b.distance_from_you;
    });
  }

  return NextResponse.json({ listings });
}

export async function POST(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json();
  const { name, category, size, color, price, deposit, description, photos, care_instructions, lat, lng } = body;

  if (!name || !category || !size || !price || !deposit || !description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const photoList = Array.isArray(photos) ? photos.filter(Boolean) : [];

  const { data, error } = await supabase
    .from('listings')
    .insert({
      owner_id: user.id,
      name,
      category,
      size,
      price_cents: Math.round(parseFloat(price) * 100),
      deposit_cents: Math.round(parseFloat(deposit) * 100),
      description,
      photo_url: photoList[0] || null,
      photos: photoList,
      distance_miles: 0,
      care_instructions: care_instructions || null,
      color: color || null,
      lat: lat ?? null,
      lng: lng ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ listing: data });
}
