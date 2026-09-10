import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const supabaseSvc = supabaseAdmin();
  const { data, error } = await supabaseSvc
    .from('rentals')
    .select('*, listings(name), owner:owner_id(full_name), renter:renter_id(full_name)')
    .eq('stage', 'no_show').eq('no_show_status', 'under_review');

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ disputes: data });
}

// action: 'uphold' | 'dismiss'
export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const { rental_id, action } = await req.json();
  const supabaseSvc = supabaseAdmin();

  const { data: rental } = await supabaseSvc.from('rentals').select('*').eq('id', rental_id).single();
  if (!rental) return NextResponse.json({ error: 'Rental not found' }, { status: 404 });

  const { data: reportEvent } = await supabaseSvc.from('rental_events').select('*')
    .eq('rental_id', rental_id).eq('kind', 'no_show').single();
  const accusedRole = reportEvent?.payload?.reported;
  const accusedUserId = accusedRole === 'owner' ? rental.owner_id : rental.renter_id;

  if (action === 'uphold') {
    const { data: p } = await supabaseSvc.from('profiles').select('no_show_count').eq('id', accusedUserId).single();
    await supabaseSvc.from('profiles').update({ no_show_count: (p?.no_show_count || 0) + 1 }).eq('id', accusedUserId);
    await supabaseSvc.from('rentals').update({ no_show_status: 'confirmed' }).eq('id', rental_id);
  } else {
    await supabaseSvc.from('rentals').update({ no_show_status: 'dismissed' }).eq('id', rental_id);
  }

  await supabaseSvc.from('rental_events').insert({
    rental_id, kind: 'message', actor_id: null,
    payload: { text: `Admin ${action === 'uphold' ? 'upheld' : 'dismissed'} the no-show dispute.`, system: true },
  });

  return NextResponse.json({ ok: true });
}
