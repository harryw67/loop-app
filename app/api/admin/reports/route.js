import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const supabaseSvc = supabaseAdmin();
  const { data, error } = await supabaseSvc
    .from('reports')
    .select('*, reporter:reporter_id(full_name), reported:reported_user_id(full_name, no_show_count, suspended)')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ reports: data });
}
