import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data, error } = await supabase
    .from('favorites')
    .select('listing_id, listings(*, profiles(full_name))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ favorites: data });
}

export async function POST(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { listing_id } = await req.json();
  const { data: existing } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('listing_id', listing_id).maybeSingle();

  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id);
    return NextResponse.json({ favorited: false });
  } else {
    await supabase.from('favorites').insert({ user_id: user.id, listing_id });
    return NextResponse.json({ favorited: true });
  }
}
