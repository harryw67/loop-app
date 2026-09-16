import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { stripe } from '@/lib/stripe';

async function timedCheck(fn) {
  const start = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

export async function GET() {
  const database = await timedCheck(async () => {
    const admin = supabaseAdmin();
    const { error } = await admin.from('listings').select('id').limit(1);
    if (error) throw error;
  });

  const payments = await timedCheck(async () => {
    await stripe.balance.retrieve();
  });

  return NextResponse.json({
    database,
    payments,
    checkedAt: new Date().toISOString(),
  });
}
