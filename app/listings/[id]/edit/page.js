'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

const CATEGORIES = ['Dress', 'Two-piece set', 'Skirt', 'Top', 'Jumpsuit', 'Outerwear', 'Shoes', 'Bag / Accessory'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const DISTANCES = [
  { label: 'On campus', value: 0 },
  { label: 'Within 1 mile', value: 1 },
  { label: 'Within 3 miles', value: 3 },
  { label: 'Within 5 miles', value: 5 },
  { label: '5+ miles', value: 10 },
];

export default function EditListingPage({ params }) {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase.from('listings').select('*').eq('id', params.id).single();
      if (!data || data.owner_id !== user.id) { router.push('/'); return; }
      setForm({
        name: data.name, category: data.category, size: data.size,
        price: (data.price_cents / 100).toString(), deposit: (data.deposit_cents / 100).toString(),
        description: data.description, distance: data.distance_miles || 0,
      });
      setPhotos(data.photos?.length ? data.photos : (data.photo_url ? [data.photo_url] : []));
    });
  }, [params.id]);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const removePhoto = (i) => setPhotos(photos.filter((_, idx) => idx !== i));

  const submit = async () => {
    setError('');
    if (!form.name || !form.description || !form.price || !form.deposit) {
      setError('Fill in a name, description, price, and deposit.');
      return;
    }
    setSaving(true);
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();

    let finalPhotos = [...photos];
    for (const file of newFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('photos').upload(path, file);
      if (upErr) { setError(upErr.message); setSaving(false); return; }
      finalPhotos.push(supabase.storage.from('photos').getPublicUrl(path).data.publicUrl);
    }

    const res = await fetch(`/api/listings/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, photos: finalPhotos }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }
    router.push(`/listings/${params.id}`);
  };

  if (!form) return <p style={{ color: 'var(--ink-faint)' }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 22 }}>Edit listing</h1>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <div style={{ width: 70, height: 70, borderRadius: 4, background: `url(${p}) center/cover` }} />
            <button onClick={() => removePhoto(i)} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--oxblood)', color: 'white', fontSize: 11, border: 'none' }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ border: '1px dashed var(--line)', borderRadius: 4, padding: 16, textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13, marginBottom: 18 }}>
        <input type="file" accept="image/*" multiple onChange={e => setNewFiles(Array.from(e.target.files))} />
        {newFiles.length > 0 && <div style={{ marginTop: 8 }}>{newFiles.length} new photo(s) to add</div>}
      </div>

      <div className="field" style={{ marginBottom: 18 }}>
        <label>Item name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} />
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
          <input value={form.price} onChange={e => set('price', e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Deposit</label>
          <input value={form.deposit} onChange={e => set('deposit', e.target.value)} />
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
        <textarea style={{ minHeight: 80 }} value={form.description} onChange={e => set('description', e.target.value)} />
      </div>

      {error && <p style={{ color: 'var(--oxblood)', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
      <button className="btn btn-primary btn-block" onClick={submit} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
