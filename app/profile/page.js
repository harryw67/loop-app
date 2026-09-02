'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [reviews, setReviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasCard, setHasCard] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      setUser(user);
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);
      setName(p?.full_name || '');
      const { data: r } = await supabase.from('reviews').select('*, reviewer:reviewer_id(full_name)').eq('reviewee_id', user.id).order('created_at', { ascending: false });
      setReviews(r || []);

      fetch('/api/stripe/payment-method-status').then(res => res.json()).then(d => setHasCard(!!d.hasCard));
      fetch('/api/stripe/connect-status').then(res => res.json()).then(setPayoutStatus);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const supabase = supabaseBrowser();
    await supabase.from('profiles').update({ full_name: name }).eq('id', user.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const connectPayouts = async () => {
    setConnecting(true);
    const res = await fetch('/api/stripe/connect', { method: 'POST' });
    const data = await res.json();
    setConnecting(false);
    if (data.url) window.location.href = data.url;
  };

  if (!user || !profile) return <p style={{ color: 'var(--ink-faint)' }}>Loading…</p>;

  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 22 }}>Your profile</h1>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Name shown to other users</label>
        <input value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 14 }}>{user.email}</div>
      <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save name'}</button>
      {saved && <span style={{ fontSize: 12.5, color: 'var(--sage-ink)', marginLeft: 10 }}>Saved</span>}

      <div style={{ marginTop: 36, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Payment method</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 10 }}>
          {hasCard ? 'A card is on file — used to pay for rentals.' : "No card on file yet — you'll need one before confirming a handoff as a renter."}
        </p>
        <a href="/payment-method" className="btn btn-ghost" style={{ display: 'inline-block', textDecoration: 'none' }}>{hasCard ? 'Update card' : 'Add a card'}</a>
      </div>

      <div style={{ marginTop: 30, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Payout account</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 10 }}>
          {payoutStatus?.payoutsEnabled ? 'Connected — you can receive payouts from rentals you own.'
            : payoutStatus?.connected ? 'Setup started but not finished — finish onboarding to receive payouts.'
            : "Not connected yet — you'll need this before anyone can rent from you."}
        </p>
        <button className="btn btn-ghost" onClick={connectPayouts} disabled={connecting}>
          {connecting ? 'Redirecting…' : payoutStatus?.connected ? 'Finish setup' : 'Connect with Stripe'}
        </button>
      </div>

      <div style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 6 }}>
          Your reputation {avgRating && <span style={{ color: 'var(--mustard-ink)' }}>· {avgRating}★</span>}
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 16 }}>
          {reviews.length ? `${reviews.length} review${reviews.length === 1 ? '' : 's'} from people you've rented with` : "No reviews yet — they show up after your first settled rental."}
        </p>
        {reviews.map(r => (
          <div key={r.id} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>· {r.reviewer?.full_name}</span></div>
            {r.comment && <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>{r.comment}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
