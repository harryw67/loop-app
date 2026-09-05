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

  try {
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
    if (!origin || origin.includes('localhost')) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL is not set to a real https URL — Stripe needs a live URL for this step. Check your environment variables.' }, { status: 500 });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/profile?onboarding=retry`,
      return_url: `${origin}/profile?onboarding=done`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    console.error('stripe connect error:', err);
    return NextResponse.json({ error: err.message || 'Could not start Stripe onboarding — try again.' }, { status: 500 });
  }
}
