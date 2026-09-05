import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';

// Called from the client right before a renter confirms a handoff for the
// first time. Creates (or reuses) a Stripe Customer for them and returns a
// SetupIntent client secret so the browser can collect a card via Stripe
// Elements. Once confirmed client-side, POST the resulting payment_method
// id back here to save it as their default.
export async function POST(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { supabase_user_id: user.id } });
    customerId = customer.id;
    // uses the admin client — stripe_customer_id is a system-controlled
    // field that a user's own session is no longer allowed to write directly
    await supabaseAdmin().from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });

  return NextResponse.json({ client_secret: setupIntent.client_secret, customer_id: customerId });
}

// After Stripe Elements confirms the SetupIntent client-side, save the resulting
// payment method as this user's default so future charges can reuse it.
export async function PATCH(req) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { payment_method_id } = await req.json();
  const { error } = await supabaseAdmin()
    .from('profiles')
    .update({ default_payment_method_id: payment_method_id })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
