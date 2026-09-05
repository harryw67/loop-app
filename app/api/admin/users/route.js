import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const q = new URL(req.url).searchParams.get('q') || '';
  const supabaseSvc = supabaseAdmin();
  const { data, error } = await supabaseSvc
    .from('profiles')
    .select('*')
    .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ users: data });
}

// action: 'suspend' | 'unsuspend'
export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const { user_id, action } = await req.json();
  const supabaseSvc = supabaseAdmin();
  await supabaseSvc.from('profiles').update({ suspended: action === 'suspend' }).eq('id', user_id);
  return NextResponse.json({ ok: true });
}
