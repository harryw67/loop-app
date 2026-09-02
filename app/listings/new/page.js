'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import TermsModal from '@/components/TermsModal';

const CATEGORIES = ['Dress', 'Two-piece set', 'Skirt', 'Top', 'Jumpsuit', 'Outerwear', 'Shoes', 'Bag / Accessory'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const DISTANCES = [
  { label: 'On campus', value: 0 },
  { label: 'Within 1 mile', value: 1 },
  { label: 'Within 3 miles', value: 3 },
  { label: 'Within 5 miles', value: 5 },
  { label: '5+ miles', value: 10 },
];

export default function NewListingPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', category: 'Dress', size: 'S', price: '', deposit: '', description: '', distance: 0 });
  const [files, setFiles] = useState([]);
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

  const submit = async () => {
    setError('');
    if (!form.name || !form.description || !form.price || !form.deposit) {
      setError('Fill in a name, description, price, and deposit before publishing.');
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
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('photos').upload(path, file);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
      photoUrls.push(supabase.storage.from('photos').getPublicUrl(path).data.publicUrl);
    }

    const res = await fetch('/api/listings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, photos: photoUrls }),
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

      <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
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

      <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Price per day</label>
          <input value={form.price} onChange={e => set('price', e.target.value)} placeholder="22" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Deposit</label>
          <input value={form.deposit} onChange={e => set('deposit', e.target.value)} placeholder="40" />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label>Distance from campus</label>
        <select value={form.distance} onChange={e => set('distance', parseInt(e.target.value))}>
          {DISTANCES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
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
                <div style={{ width: 36, height: 46, flexShrink: 0, background: l.photo_url ? `url(${l.photo_url}) center/cover` : 'var(--cream-2)' }} />
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
