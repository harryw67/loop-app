import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseServer';

// Register this URL in the Stripe dashboard (Developers > Webhooks) once deployed:
// https://your-app.vercel.app/api/stripe/webhook
// Listen for at least: account.updated, payment_intent.payment_failed

export async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${err.message}` }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  if (event.type === 'account.updated') {
    const account = event.data.object;
    if (account.charges_enabled && account.payouts_enabled) {
      await supabase.from('profiles').update({ stripe_onboarded: true }).eq('stripe_account_id', account.id);
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    // TODO: find the rental by rental_payment_intent_id / deposit_payment_intent_id
    // and post a system message into the thread so both parties see the failure.
    console.error('Payment failed', pi.id, pi.last_payment_error?.message);
  }

  return NextResponse.json({ received: true });
}
