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
  const availFrom = searchParams.get('availFrom');
  const availTo = searchParams.get('availTo');

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

  // filter out listings from anyone the current user has blocked, and
  // anyone who has blocked the current user (both directions)
  let listings = data;
  if (user) {
    const { data: blocks } = await supabase.from('blocks').select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    const hiddenOwnerIds = new Set();
    (blocks || []).forEach(b => {
      if (b.blocker_id === user.id) hiddenOwnerIds.add(b.blocked_id);
      if (b.blocked_id === user.id) hiddenOwnerIds.add(b.blocker_id);
    });
    if (hiddenOwnerIds.size) listings = listings.filter(l => !hiddenOwnerIds.has(l.owner_id));
  }

  // exclude listings that are already booked for any part of a requested date range
  if (availFrom && availTo) {
    const listingIds = listings.map(l => l.id);
    if (listingIds.length) {
      const { data: overlapping } = await supabase.from('rentals').select('listing_id, start_date, end_date')
        .in('listing_id', listingIds).in('stage', ['pending', 'booked', 'out', 'return']);
      const unavailable = new Set(
        (overlapping || [])
          .filter(r => r.start_date && r.end_date && availFrom <= r.end_date && availTo >= r.start_date)
          .map(r => r.listing_id)
      );
      listings = listings.filter(l => !unavailable.has(l.id));
    }
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
  const { name, category, size, color, price, deposit, description, photos, care_instructions, lat, lng, min_days, max_days } = body;

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
      min_days: min_days ? parseInt(min_days) : 1,
      max_days: max_days ? parseInt(max_days) : 14,
      color: color || null,
      lat: lat ?? null,
      lng: lng ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ listing: data });
}
