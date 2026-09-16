import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const supabaseSvc = supabaseAdmin();
  const { data: rentals, error } = await supabaseSvc
    .from('rentals')
    .select('*, listings(name), owner:owner_id(full_name), renter:renter_id(full_name)')
    .eq('stage', 'disputed');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // attach the dispute reason + any condition photos so admin can actually judge it
  const withDetails = await Promise.all((rentals || []).map(async (r) => {
    const { data: events } = await supabaseSvc.from('rental_events').select('*').eq('rental_id', r.id);
    const disputeEvent = events?.find(e => e.kind === 'dispute');
    const photos = events?.filter(e => e.kind === 'photo') || [];
    return { ...r, dispute_reason: disputeEvent?.payload?.reason || '', photos };
  }));

  return NextResponse.json({ disputes: withDetails });
}

// action: 'refund_renter' (release the deposit hold back to the renter) |
// 'capture_deposit' (capture the deposit — funds land in Loop's own balance,
// to be forwarded to the owner manually as compensation, same manual-payout
// pattern used elsewhere until Stripe Connect is fully wired up)
export async function POST(req) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Not authorized' }, { status: 403 });

  const { rental_id, action } = await req.json();
  const supabaseSvc = supabaseAdmin();

  const { data: rental } = await supabaseSvc.from('rentals').select('*').eq('id', rental_id).single();
  if (!rental) return NextResponse.json({ error: 'Rental not found' }, { status: 404 });
  if (rental.stage !== 'disputed') return NextResponse.json({ error: 'Not currently disputed' }, { status: 400 });

  try {
    if (rental.deposit_payment_intent_id) {
      if (action === 'refund_renter') {
        await stripe.paymentIntents.cancel(rental.deposit_payment_intent_id);
      } else if (action === 'capture_deposit') {
        await stripe.paymentIntents.capture(rental.deposit_payment_intent_id);
      }
    }
  } catch (err) {
    return NextResponse.json({ error: `Stripe error: ${err.message}` }, { status: 400 });
  }

  await supabaseSvc.from('rentals').update({ stage: 'settled' }).eq('id', rental_id);
  await supabaseSvc.from('rental_events').insert({
    rental_id, kind: 'message', actor_id: null,
    payload: {
      text: action === 'refund_renter'
        ? 'Admin resolved this dispute — deposit released back to the renter.'
        : 'Admin resolved this dispute — deposit captured to compensate the owner (forwarded manually).',
      system: true,
    },
  });

  return NextResponse.json({ ok: true });
}
