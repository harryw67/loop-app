import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';

const RETURN_GRACE_HOURS = 48;
const REFERRAL_CREDIT_EXPIRY_DAYS = 180;

// Runs once a day (see vercel.json). Protected by a secret header.
export async function GET(req) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();
  const results = {};

  // 1. bookings whose dates passed with no handoff ever happening
  const { data: staleBooked } = await supabase.from('rentals').select('*').eq('stage', 'booked').lt('end_date', today);
  let expired = 0;
  for (const rental of staleBooked || []) {
    if (rental.rental_payment_intent_id) await stripe.paymentIntents.cancel(rental.rental_payment_intent_id).catch(() => {});
    if (rental.deposit_payment_intent_id) await stripe.paymentIntents.cancel(rental.deposit_payment_intent_id).catch(() => {});
    await supabase.from('rentals').update({ stage: 'expired' }).eq('id', rental.id);
    await supabase.from('rental_events').insert({
      rental_id: rental.id, kind: 'message', actor_id: null,
      payload: { text: "This booking's dates passed with no handoff — automatically cancelled and any hold released.", system: true },
    });
    expired++;
  }
  results.expired = expired;

  // 2. pending requests that sat unanswered past their 36h expiry
  const { data: stalePending } = await supabase.from('rentals').select('*').eq('stage', 'pending').lt('expires_at', nowIso);
  let autoDeclined = 0;
  for (const rental of stalePending || []) {
    await supabase.from('rentals').update({ stage: 'declined' }).eq('id', rental.id);
    await supabase.from('rental_events').insert({
      rental_id: rental.id, kind: 'message', actor_id: null,
      payload: { text: 'This request expired after 36 hours with no response.', system: true },
    });
    autoDeclined++;
  }
  results.autoDeclined = autoDeclined;

  // 3. return grace period: owner confirmed "looks good", renter went quiet
  // for 48h — auto-release the deposit rather than leave it stuck forever.
  // (Never auto-resolves in anyone's favor if an issue was flagged — those
  // move to 'disputed' immediately and this loop doesn't touch them.)
  const { data: pendingReturns } = await supabase.from('rentals').select('*').eq('stage', 'return');
  let autoSettled = 0;
  for (const rental of pendingReturns || []) {
    const { data: confirms } = await supabase.from('rental_events').select('*')
      .eq('rental_id', rental.id).eq('kind', 'confirm');
    const ownerConfirm = confirms?.find(e => e.payload?.phase === 'return' && e.payload?.role === 'owner');
    const renterConfirm = confirms?.find(e => e.payload?.phase === 'return' && e.payload?.role === 'renter');
    if (ownerConfirm && !renterConfirm) {
      const hoursSince = (Date.now() - new Date(ownerConfirm.created_at).getTime()) / (60 * 60 * 1000);
      if (hoursSince >= RETURN_GRACE_HOURS) {
        if (rental.deposit_payment_intent_id) await stripe.paymentIntents.cancel(rental.deposit_payment_intent_id).catch(() => {});
        await supabase.from('rentals').update({ stage: 'settled' }).eq('id', rental.id);
        await supabase.from('rental_events').insert({
          rental_id: rental.id, kind: 'deposit_refunded', actor_id: null,
          payload: { text: 'Renter had no response for 48h after the owner confirmed a clean return — deposit auto-released.' },
        });
        autoSettled++;
      }
    }
  }
  results.autoSettled = autoSettled;

  // 4. referral credit expires after 180 days of no new credit earned
  const cutoff = new Date(Date.now() - REFERRAL_CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleCredit } = await supabase.from('profiles').select('id').gt('referral_credit_cents', 0).lt('referral_credit_earned_at', cutoff);
  for (const p of staleCredit || []) {
    await supabase.from('profiles').update({ referral_credit_cents: 0 }).eq('id', p.id);
  }
  results.creditExpired = (staleCredit || []).length;

  return NextResponse.json(results);
}
