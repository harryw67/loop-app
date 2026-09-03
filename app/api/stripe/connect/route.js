import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';

// Called when a user first tries to list an item or gets confirmed as an
// owner in a rental. Creates a Stripe Express connected account for them
// (if they don't have one) and returns an onboarding link — Stripe hosts
// the actual "enter your bank details" form, so Loop never touches that data.
export async function POST() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  let accountId = profile?.stripe_account_id;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: user.email,
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
    });
    accountId = account.id;
    await supabase.from('profiles').update({ stripe_account_id: accountId }).eq('id', user.id);
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL;
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/list?onboarding=retry`,
    return_url: `${origin}/list?onboarding=done`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
