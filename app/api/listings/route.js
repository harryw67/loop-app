import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { distanceMiles } from '@/lib/location';

const PAGE_SIZE = 24;
const JS_FILTER_CAP = 500; // when location/availability sorting forces JS-side work, cap how much we pull at once

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
  const page = Math.max(1, parseInt(searchParams.get('page')) || 1);

  // block filtering happens at the DB level (not a JS post-filter), so it
  // doesn't interfere with pagination
  let hiddenOwnerIds = [];
  if (user) {
    const { data: blocks } = await supabase.from('blocks').select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    const hidden = new Set();
    (blocks || []).forEach(b => {
      if (b.blocker_id === user.id) hidden.add(b.blocked_id);
      if (b.blocked_id === user.id) hidden.add(b.blocker_id);
    });
    hiddenOwnerIds = [...hidden];
  }

  const needsJsFiltering = (myLat != null && myLng != null) || (availFrom && availTo);

  function buildBaseQuery(countOption) {
    let query = supabase
      .from('listings')
      .select('*, profiles(full_name)', countOption ? { count: 'exact' } : undefined)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (maxPrice) query = query.lte('price_cents', parseInt(maxPrice) * 100);
    if (sizes) query = query.in('size', sizes.split(','));
    if (categories) query = query.in('category', categories.split(','));
    if (search) query = query.ilike('name', `%${search}%`);
    if (colors) query = query.in('color', colors.split(','));
    if (hiddenOwnerIds.length) query = query.not('owner_id', 'in', `(${hiddenOwnerIds.join(',')})`);
    return query;
  }

  // ---- simple case: no distance sort, no date filter — real DB pagination ----
  if (!needsJsFiltering) {
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await buildBaseQuery(true).range(from, to);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ listings: data, hasMore: count != null ? to + 1 < count : data.length === PAGE_SIZE, total: count });
  }

  // ---- location and/or date-availability filtering requires JS work, so we
  // pull a capped batch, filter/sort in JS, then paginate the result in JS.
  // This is bounded (JS_FILTER_CAP), not "fetch literally everything." ----
  const { data, error } = await buildBaseQuery(false).limit(JS_FILTER_CAP);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  let listings = data;

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

  const from = (page - 1) * PAGE_SIZE;
  const pageItems = listings.slice(from, from + PAGE_SIZE);
  const hasMore = from + PAGE_SIZE < listings.length;

  return NextResponse.json({ listings: pageItems, hasMore, total: listings.length });
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
