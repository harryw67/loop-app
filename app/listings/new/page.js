'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { compressImage } from '@/lib/imageCompress';
import { supabaseBrowser } from '@/lib/supabaseClient';
import TermsModal from '@/components/TermsModal';
import PhotoTile from '@/components/PhotoTile';
import { getCurrentPosition, jitterLocation } from '@/lib/location';

const CATEGORIES = ['Dress', 'Two-piece set', 'Skirt', 'Top', 'Jumpsuit', 'Outerwear', 'Suit', 'Blazer', 'Dress Shirt', 'Pants', 'Jeans', 'Shorts', 'Sweater', 'T-Shirt', 'Tie / Bowtie', 'Shoes', 'Bag / Accessory'];
const GENDERS = ["Women's", "Men's", 'Unisex'];
const COLORS = ['Black', 'White', 'Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Brown', 'Beige / Tan', 'Gold / Silver', 'Multicolor'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

export default function NewListingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', category: 'Dress', size: 'S', color: 'Black', gender: "Women's", price: '', deposit: '', description: '', care_instructions: '', min_days: '1', max_days: '14' });
  const [files, setFiles] = useState([]);
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle'); // idle | requesting | granted | denied
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [myListings, setMyListings] = useState([]);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('listings').select('*').eq('owner_id', user.id).eq('active', true).order('created_at', { ascending: false });
      setMyListings(data || []);
    });
  }, []);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const requestLocation = async () => {
    setLocationStatus('requesting');
    try {
      const pos = await getCurrentPosition();
      setLocation(jitterLocation(pos.lat, pos.lng));
      setLocationStatus('granted');
    } catch {
      setLocationStatus('denied');
    }
  };

  const submit = async () => {
    setError('');
    if (!form.name || !form.description || !form.price || !form.deposit) {
      setError('Fill in a name, description, price, and deposit before publishing.');
      return;
    }
    if (parseFloat(form.deposit) < parseFloat(form.price) * 2) {
      setError('Deposit should be at least 2x the daily price — helps cover real damage costs.');
      return;
    }
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const { data: profile } = await supabase.from('profiles').select('agreed_terms_at').eq('id', user.id).single();
    if (!profile?.agreed_terms_at) { setShowTerms(true); return; }

    await doSubmit();
  };

  const doSubmit = async () => {
    setSaving(true);
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();

    let photoUrls = [];
    for (const rawFile of files) {
      const file = await compressImage(rawFile);
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('photos').upload(path, file);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
      photoUrls.push(supabase.storage.from('photos').getPublicUrl(path).data.publicUrl);
    }

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, photos: photoUrls, lat: location?.lat, lng: location?.lng }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    router.push('/');
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 22 }}>List a piece</h1>

      <div style={{ border: '1px dashed var(--line)', borderRadius: 4, padding: 22, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, marginBottom: 18 }}>
        <input type="file" accept="image/*" multiple onChange={e => setFiles(Array.from(e.target.files))} />
        {files.length > 0 && <div style={{ marginTop: 8, color: 'var(--ink-soft)' }}>{files.length} photo(s) selected</div>}
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label>Item name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Camel wrap midi" />
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1 }}>
          <label>For</label>
          <select value={form.gender} onChange={e => set('gender', e.target.value)}>
            {GENDERS.map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Size</label>
          <select value={form.size} onChange={e => set('size', e.target.value)}>
            {SIZES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label>Color</label>
        <select value={form.color} onChange={e => set('color', e.target.value)}>
          {COLORS.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Price per day</label>
          <input value={form.price} onChange={e => set('price', e.target.value)} placeholder="22" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Deposit</label>
          <input value={form.deposit} onChange={e => set('deposit', e.target.value)} placeholder="40" />
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 18 }}>
        We recommend a deposit around 30–50% of what this item would cost to replace — must be at least 2x the daily price.
      </p>

      <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Minimum rental (days)</label>
          <input value={form.min_days} onChange={e => set('min_days', e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Maximum rental (days)</label>
          <input value={form.max_days} onChange={e => set('max_days', e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label>Your location</label>
        <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 8 }}>
          Used to show renters how far away this is — we save an approximate location, not your exact address, so no one can pinpoint where you live.
        </p>
        {locationStatus === 'granted' ? (
          <span style={{ fontSize: 12.5, color: 'var(--sage-ink)' }}>✓ Location captured</span>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={requestLocation} disabled={locationStatus === 'requesting'}>
            {locationStatus === 'requesting' ? 'Requesting…' : locationStatus === 'denied' ? 'Location denied — try again' : 'Share my location'}
          </button>
        )}
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label>Care / washing instructions (optional)</label>
        <input value={form.care_instructions} onChange={e => set('care_instructions', e.target.value)} placeholder="e.g. Dry clean only, or hand wash cold" />
      </div>

      <div className="field" style={{ marginBottom: 12 }}>
        <label>Description</label>
        <textarea style={{ minHeight: 80 }} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Fabric, fit, where you've worn it, any notes for renters..." />
      </div>

      {error && <p style={{ color: 'var(--oxblood)', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
      <button className="btn btn-primary btn-block" onClick={submit} disabled={saving}>
        {saving ? 'Publishing…' : 'Publish listing'}
      </button>

      {myListings.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 14 }}>Your listings</h2>
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
      {showTerms && (
        <TermsModal
          onAgree={() => { setShowTerms(false); doSubmit(); }}
          onCancel={() => setShowTerms(false)}
        />
      )}
    </div>
  );
}
