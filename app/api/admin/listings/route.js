import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const q = new URL(req.url).searchParams.get('q') || '';
  const supabaseSvc = supabaseAdmin();
  const { data, error } = await supabaseSvc
    .from('listings')
    .select('*, profiles(full_name, username)')
    .eq('active', true)
    .ilike('name', `%${q}%`)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ listings: data });
}
