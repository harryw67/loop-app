'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const CATEGORIES = ['Dress', 'Two-piece set', 'Skirt', 'Top', 'Jumpsuit', 'Outerwear', 'Shoes', 'Bag / Accessory'];
const DISTANCES = [
  { label: 'Any distance', value: null },
  { label: 'On campus', value: 0 },
  { label: 'Within 1 mile', value: 1 },
  { label: 'Within 3 miles', value: 3 },
  { label: 'Within 5 miles', value: 5 },
];

export default function BrowsePage() {
  const router = useRouter();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sizes, setSizes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [maxPrice, setMaxPrice] = useState(100);
  const [maxDistance, setMaxDistance] = useState(null);
  const [open, setOpen] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [me, setMe] = useState(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setMe(user);
      if (user) fetch('/api/favorites').then(r => r.json()).then(d => setFavIds(new Set((d.favorites || []).map(f => f.listing_id))));
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (sizes.length) params.set('sizes', sizes.join(','));
    if (categories.length) params.set('categories', categories.join(','));
    if (maxPrice < 100) params.set('maxPrice', maxPrice);
    if (maxDistance !== null) params.set('maxDistance', maxDistance);
    if (search.trim()) params.set('search', search.trim());
    setLoading(true);
    setError('');
    fetch(`/api/listings?${params}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setListings([]); }
        else setListings(d.listings || []);
      })
      .catch(() => setError('Could not load listings — check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [sizes, categories, maxPrice, maxDistance, search]);

  const toggleFavorite = async (e, listingId) => {
    e.stopPropagation();
    if (!me) { router.push('/login'); return; }
    const res = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: listingId }) });
    const data = await res.json();
    setFavIds(prev => {
      const next = new Set(prev);
      if (data.favorited) next.add(listingId); else next.delete(listingId);
      return next;
    });
  };

  const toggle = (arr, setArr, val) => setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 500 }}>Rent something for this weekend</h1>
          <p style={{ color: 'var(--ink-soft)', fontSize: 14, marginTop: 4 }}>
            {loading ? 'Loading…' : `${listings.length} pieces available`}
          </p>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '9px 16px', fontSize: 13.5, background: 'var(--white)', minWidth: 200 }}
        />
      </div>

      {error && (
        <div style={{ background: 'var(--oxblood-bg)', color: 'var(--oxblood-ink)', border: '1px solid var(--oxblood)', borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 8, position: 'relative', flexWrap: 'wrap' }}>
          <Dropdown label={sizes.length ? sizes.join(', ') : 'All sizes'} openKey="size" open={open} setOpen={setOpen} active={sizes.length}>
            {SIZES.map(s => (
              <label key={s} style={optStyle}>
                <input type="checkbox" checked={sizes.includes(s)} onChange={() => toggle(sizes, setSizes, s)} /> {s}
              </label>
            ))}
          </Dropdown>
          <Dropdown label={maxPrice >= 100 ? 'Any price' : `Under $${maxPrice}`} openKey="price" open={open} setOpen={setOpen} active={maxPrice < 100}>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>$5</span><span>Up to ${maxPrice}</span><span>$100+</span>
            </div>
            <input type="range" min="5" max="100" step="5" value={maxPrice} onChange={e => setMaxPrice(parseInt(e.target.value))} style={{ width: '100%' }} />
          </Dropdown>
          <Dropdown label={categories.length ? (categories.length === 1 ? categories[0] : `${categories.length} types`) : 'Category'} openKey="category" open={open} setOpen={setOpen} active={categories.length}>
            {CATEGORIES.map(c => (
              <label key={c} style={optStyle}>
                <input type="checkbox" checked={categories.includes(c)} onChange={() => toggle(categories, setCategories, c)} /> {c}
              </label>
            ))}
          </Dropdown>
          <Dropdown label={DISTANCES.find(d => d.value === maxDistance)?.label || 'Distance'} openKey="distance" open={open} setOpen={setOpen} active={maxDistance !== null}>
            {DISTANCES.map(d => (
              <label key={d.label} style={optStyle}>
                <input type="radio" name="distance" checked={maxDistance === d.value} onChange={() => setMaxDistance(d.value)} /> {d.label}
              </label>
            ))}
          </Dropdown>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '26px 20px' }}>
        {!loading && listings.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--ink-faint)' }}>
            <div className="serif" style={{ fontSize: 19, color: 'var(--ink-soft)' }}>No pieces match those filters</div>
          </div>
        )}
        {listings.map(l => (
          <div
            key={l.id}
            onClick={() => router.push(`/listings/${l.id}`)}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ aspectRatio: '3/4', background: l.photo_url ? `url(${l.photo_url}) center/cover no-repeat` : 'var(--cream-2)', backgroundSize: 'cover', borderRadius: 2, position: 'relative' }}>
              <button
                onClick={e => toggleFavorite(e, l.id)}
                style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(246,242,233,0.92)', border: 'none', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {favIds.has(l.id) ? '★' : '☆'}
              </button>
            </div>
            <div style={{ marginTop: 10, pointerEvents: 'none' }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>{l.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 12.5 }}>
                <span style={{ color: 'var(--ink-faint)' }}>{l.profiles?.full_name || 'Owner'}</span>
                <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>${(l.price_cents / 100).toFixed(0)}/day</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const optStyle = { display: 'flex', alignItems: 'center', gap: 9, padding: '6px 2px', fontSize: 13.5, cursor: 'pointer' };

function Dropdown({ label, openKey, open, setOpen, active, children }) {
  const isOpen = open === openKey;
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(isOpen ? null : openKey)}
        style={{
          padding: '7px 14px', borderRadius: 999, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
          border: `1px solid ${active ? 'var(--oxblood)' : 'var(--line)'}`,
          color: active ? 'var(--oxblood-ink)' : 'var(--ink-soft)',
          background: active ? 'var(--oxblood-bg)' : 'var(--white)',
        }}
      >
        {label} <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>&#9662;</span>
      </button>
      {isOpen && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 20, background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 6, padding: '14px 16px', minWidth: 190, boxShadow: '0 6px 18px rgba(34,30,25,0.08)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
