'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import PhotoTile from '@/components/PhotoTile';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [reviews, setReviews] = useState([]);
  const [myListings, setMyListings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasCard, setHasCard] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [refInput, setRefInput] = useState('');
  const [refError, setRefError] = useState('');
  const [refSaving, setRefSaving] = useState(false);

  const load = async () => {
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);
    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(p);
    setName(p?.full_name || '');
    const { data: r } = await supabase.from('reviews').select('*, reviewer:reviewer_id(full_name)').eq('reviewee_id', user.id).order('created_at', { ascending: false });
    setReviews(r || []);
    const { data: listings } = await supabase.from('listings').select('*').eq('owner_id', user.id).eq('active', true).order('created_at', { ascending: false });
    setMyListings(listings || []);

    fetch('/api/stripe/payment-method-status').then(res => res.json()).then(d => setHasCard(!!d.hasCard));
    fetch('/api/stripe/connect-status').then(res => res.json()).then(setPayoutStatus);
  };

  useEffect(() => { load(); }, []);

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

  const applyReferral = async () => {
    setRefError('');
    const code = refInput.trim().toUpperCase();
    if (!code) return;
    if (code === profile.referral_code) { setRefError("That's your own code."); return; }
    setRefSaving(true);
    const supabase = supabaseBrowser();
    const { data: match } = await supabase.from('profiles').select('id').eq('referral_code', code).maybeSingle();
    if (!match) { setRefError('Code not found.'); setRefSaving(false); return; }
    await supabase.from('profiles').update({ referred_by: code }).eq('id', user.id);
    setRefSaving(false);
    load();
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

      <div style={{ marginTop: 30, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 6 }}>Referrals</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginBottom: 10 }}>
          Share your code — anyone who uses it gets 5% off their first rental, and you get a 5% credit when they book.
        </p>
        <div style={{ fontSize: 22, fontFamily: 'Fraunces, serif', fontWeight: 600, letterSpacing: 3, marginBottom: 6 }}>{profile.referral_code}</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 16 }}>
          Credit earned: ${((profile.referral_credit_cents || 0) / 100).toFixed(2)}
        </div>

        {profile.referred_by ? (
          <p style={{ fontSize: 12.5, color: 'var(--sage-ink)' }}>You're using referral code {profile.referred_by} — 5% off your bookings.</p>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={refInput} onChange={e => setRefInput(e.target.value)} placeholder="Enter a code" style={{ flex: 1, padding: 8, border: '1px solid var(--line)', borderRadius: 4, fontSize: 13 }} />
              <button className="btn btn-ghost" onClick={applyReferral} disabled={refSaving}>{refSaving ? 'Applying…' : 'Apply'}</button>
            </div>
            {refError && <p style={{ color: 'var(--oxblood)', fontSize: 12, marginTop: 6 }}>{refError}</p>}
          </div>
        )}
      </div>

      {myListings.length > 0 && (
        <div style={{ marginTop: 30, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>Your listings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
            {myListings.map(l => (
              <div key={l.id} onClick={() => router.push(`/listings/${l.id}`)} style={{ background: 'var(--white)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ width: 36, height: 46, flexShrink: 0 }}><PhotoTile url={l.photo_url} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{l.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>${(l.price_cents / 100).toFixed(0)}/day · size {l.size}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 30, paddingTop: 24, borderTop: '1px solid var(--line)' }}>
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
