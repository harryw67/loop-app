'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '@/lib/stripeClient';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function PaymentMethodPage() {
  const [clientSecret, setClientSecret] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/stripe/setup-intent', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setClientSecret(d.client_secret); });
  }, []);

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 8 }}>Add a payment method</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 22 }}>
        This card is charged for the rental price when you confirm a handoff, and held (not charged) for the deposit until you return the item in matching condition.
      </p>
      {error && <p style={{ color: 'var(--oxblood)', fontSize: 13, marginBottom: 14 }}>{error}</p>}
      {clientSecret && (
        <Elements stripe={getStripe()} options={{ clientSecret }}>
          <CardForm clientSecret={clientSecret} />
        </Elements>
      )}
    </div>
  );
}

function CardForm({ clientSecret }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    setError('');

    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();

    const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
      clientSecret,
      { payment_method: { card: elements.getElement(CardElement), billing_details: { email: user?.email } } }
    );

    if (stripeError) { setError(stripeError.message); setSaving(false); return; }

    const res = await fetch('/api/stripe/setup-intent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method_id: setupIntent.payment_method }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    setDone(true);
    setTimeout(() => router.back(), 1200);
  };

  if (done) return <p style={{ color: 'var(--sage-ink)', fontSize: 14 }}>Card saved — taking you back…</p>;

  return (
    <form onSubmit={submit}>
      <div style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 14, background: 'var(--white)', marginBottom: 14 }}>
        <CardElement options={{ style: { base: { fontSize: '15px', color: '#2A241C', '::placeholder': { color: '#A79C87' } } } }} />
      </div>
      {error && <p style={{ color: 'var(--oxblood)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <button className="btn btn-primary btn-block" disabled={!stripe || saving}>
        {saving ? 'Saving…' : 'Save card'}
      </button>
      <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 10 }}>
        Test mode: use card number 4242 4242 4242 4242, any future expiry, any CVC.
      </p>
    </form>
  );
}
