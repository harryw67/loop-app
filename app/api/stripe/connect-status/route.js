import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';

export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('stripe_account_id').eq('id', user.id).single();
  if (!profile?.stripe_account_id) return NextResponse.json({ connected: false, payoutsEnabled: false });

  try {
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const payoutsEnabled = !!(account.charges_enabled && account.payouts_enabled);
    if (payoutsEnabled) await supabaseAdmin().from('profiles').update({ stripe_onboarded: true }).eq('id', user.id);
    return NextResponse.json({ connected: true, payoutsEnabled });
  } catch {
    return NextResponse.json({ connected: true, payoutsEnabled: false });
  }
}
