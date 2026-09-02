import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const { searchParams } = new URL(req.url);
  const maxPrice = searchParams.get('maxPrice');
  const sizes = searchParams.get('sizes');
  const categories = searchParams.get('categories');
  const maxDistance = searchParams.get('maxDistance');
  const search = searchParams.get('search');

  let query = supabase
    .from('listings')
    .select('*, profiles(full_name)')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (maxPrice) query = query.lte('price_cents', parseInt(maxPrice) * 100);
  if (sizes) query = query.in('size', sizes.split(','));
  if (categories) query = query.in('category', categories.split(','));
  if (maxDistance) query = query.lte('distance_miles', parseInt(maxDistance));
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // filter out listings from anyone the current user has blocked
  let listings = data;
  if (user) {
    const { data: blocked } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id);
    const blockedIds = new Set((blocked || []).map(b => b.blocked_id));
    if (blockedIds.size) listings = listings.filter(l => !blockedIds.has(l.owner_id));
  }

  return NextResponse.json({ listings });
}

export async function POST(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const body = await req.json();
  const { name, category, size, price, deposit, description, photos, distance } = body;

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
      distance_miles: distance ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ listing: data });
}
