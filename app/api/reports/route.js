import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function POST(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { reported_user_id, rental_id, reason } = await req.json();
  if (!reported_user_id || !reason) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const { data, error } = await supabase
    .from('reports')
    .insert({ reporter_id: user.id, reported_user_id, rental_id: rental_id || null, reason })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ report: data });
}
