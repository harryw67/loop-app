'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { getCurrentPosition } from '@/lib/location';
import PhotoTile from '@/components/PhotoTile';
import IntroModal from '@/components/IntroModal';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const CATEGORIES = ['Dress', 'Two-piece set', 'Skirt', 'Top', 'Jumpsuit', 'Outerwear', 'Suit', 'Blazer', 'Dress Shirt', 'Pants', 'Jeans', 'Shorts', 'Sweater', 'T-Shirt', 'Tie / Bowtie', 'Shoes', 'Bag / Accessory'];
const GENDERS = ["Women's", "Men's", 'Unisex'];
const COLORS = ['Black', 'White', 'Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Brown', 'Beige / Tan', 'Gold / Silver', 'Multicolor'];
const DISTANCES = [
  { label: 'Any distance', value: null },
  { label: 'Within 0.5 mi', value: 0.5 },
  { label: 'Within 1 mi', value: 1 },
  { label: 'Within 3 mi', value: 3 },
  { label: 'Within 5 mi', value: 5 },
];
const SORTS = [
  { label: 'Newest', value: 'newest' },
  { label: 'Price: low to high', value: 'price_asc' },
  { label: 'Price: high to low', value: 'price_desc' },
  { label: 'Nearest', value: 'distance' },
];

export default function BrowsePage() {
  return (
    <Suspense fallback={<p style={{ color: 'var(--ink-faint)' }}>Loading…</p>}>
      <BrowsePageInner />
    </Suspense>
  );
}

function BrowsePageInner() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const [listings, setListings] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(() => urlParams.get('search') || '');
  const [sizes, setSizes] = useState([]);
  const [categories, setCategories] = useState(() => urlParams.get('categories')?.split(',').filter(Boolean) || []);
  const [genders, setGenders] = useState(() => urlParams.get('genders')?.split(',').filter(Boolean) || []);
  const [colors, setColors] = useState(() => urlParams.get('colors')?.split(',').filter(Boolean) || []);
  const [maxPrice, setMaxPrice] = useState(100);
  const [maxDistance, setMaxDistance] = useState(null);
  const [sortBy, setSortBy] = useState('newest');
  const [open, setOpen] = useState(null);
  const [favIds, setFavIds] = useState(new Set());
  const [me, setMe] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [myLocation, setMyLocation] = useState(null);
  const [availFrom, setAvailFrom] = useState('');
  const [availTo, setAvailTo] = useState('');
  const [locationStatus, setLocationStatus] = useState('idle');
  const [showIntro, setShowIntro] = useState(false);

  const requestLocation = async () => {
    setLocationStatus('requesting');
    try {
      const pos = await getCurrentPosition();
      setMyLocation(pos);
      setLocationStatus('granted');
    } catch {
      setLocationStatus('denied');
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('loop_intro_seen')) setShowIntro(true);
  }, []);

  const closeIntro = () => {
    localStorage.setItem('loop_intro_seen', '1');
    setShowIntro(false);
  };

  useEffect(() => {
    fetch('/api/listings').then(r => r.json()).then(d => {
      const all = d.listings || [];
      // pick from as many different owners as possible so featured doesn't
      // show 3 items from the same closet
      const byOwner = {};
      all.forEach(l => { (byOwner[l.owner_id] ||= []).push(l); });
      const owners = Object.keys(byOwner).sort(() => Math.random() - 0.5);
      const picks = [];
      for (const ownerId of owners) {
        if (picks.length >= 3) break;
        const pool = byOwner[ownerId];
        picks.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      if (picks.length < 3) {
        const remaining = all.filter(l => !picks.some(p => p.id === l.id)).sort(() => Math.random() - 0.5);
        picks.push(...remaining.slice(0, 3 - picks.length));
      }
      setFeatured(picks);
    });
  }, []);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setMe(user);
      if (user) fetch('/api/favorites').then(r => r.json()).then(d => setFavIds(new Set((d.favorites || []).map(f => f.listing_id))));
    });
  }, []);

  const buildParams = (pageNum) => {
    const params = new URLSearchParams();
    if (sizes.length) params.set('sizes', sizes.join(','));
    if (categories.length) params.set('categories', categories.join(','));
    if (genders.length) params.set('genders', genders.join(','));
    if (colors.length) params.set('colors', colors.join(','));
    if (maxPrice < 100) params.set('maxPrice', maxPrice);
    if (maxDistance !== null) params.set('maxDistance', maxDistance);
    if (search.trim()) params.set('search', search.trim());
    if (myLocation) { params.set('lat', myLocation.lat); params.set('lng', myLocation.lng); }
    if (availFrom && availTo) { params.set('availFrom', availFrom); params.set('availTo', availTo); }
    params.set('page', pageNum);
    return params;
  };

  // any filter change resets back to page 1
  useEffect(() => {
    setPage(1);
    setLoading(true);
    setError('');
    fetch(`/api/listings?${buildParams(1)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setListings([]); setHasMore(false); }
        else { setListings(d.listings || []); setHasMore(!!d.hasMore); }
      })
      .catch(() => setError('Could not load listings — check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [sizes, categories, genders, colors, maxPrice, maxDistance, search, myLocation, availFrom, availTo]);

  const loadMore = () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    fetch(`/api/listings?${buildParams(nextPage)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.error) {
          setListings(prev => [...prev, ...(d.listings || [])]);
          setHasMore(!!d.hasMore);
          setPage(nextPage);
        }
      })
      .finally(() => setLoadingMore(false));
  };

  const sortedListings = useMemo(() => {
    const copy = [...listings];
    if (sortBy === 'price_asc') copy.sort((a, b) => a.price_cents - b.price_cents);
    else if (sortBy === 'price_desc') copy.sort((a, b) => b.price_cents - a.price_cents);
    else if (sortBy === 'distance') copy.sort((a, b) => (a.distance_from_you ?? Infinity) - (b.distance_from_you ?? Infinity));
    else copy.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return copy;
  }, [listings, sortBy]);

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
  const isNew = createdAt => (Date.now() - new Date(createdAt).getTime()) < 3 * 24 * 60 * 60 * 1000;

  return (
    <div>
      {showIntro && <IntroModal onClose={closeIntro} />}

      {featured.length > 0 && (
        <div style={{ marginBottom: 34 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            Featured today
          </div>
          <div className="featured-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
            {featured.map(l => (
              <div key={l.id} onClick={() => router.push(`/listings/${l.id}`)} style={{ cursor: 'pointer', position: 'relative' }}>
                <PhotoTile url={l.photo_url} style={{ aspectRatio: '4/5', borderRadius: 4 }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '18px 12px 10px', background: 'linear-gradient(to top, rgba(34,30,25,0.7), transparent)', borderRadius: '0 0 4px 4px' }}>
                  <div style={{ color: 'var(--white)', fontSize: 14, fontWeight: 500 }}>{l.name}</div>
                  <div style={{ color: 'var(--cream-2)', fontSize: 12 }}>${(l.price_cents / 100).toFixed(0)}/day</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '6px 14px', fontSize: 13.5, background: 'var(--white)', minWidth: 200, textAlign: 'center' }}
        />
      </div>

      {locationStatus !== 'granted' && (
        <button
          onClick={requestLocation}
          disabled={locationStatus === 'requesting'}
          style={{ fontSize: 12.5, color: 'var(--oxblood)', marginBottom: 18, textAlign: 'left' }}
        >
          {locationStatus === 'requesting' ? 'Getting your location…' : locationStatus === 'denied' ? "Couldn't get your location — tap to try again" : '📍 Share your location to see real distances'}
        </button>
      )}

      {error && (
        <div style={{ background: 'var(--oxblood-bg)', color: 'var(--oxblood-ink)', border: '1px solid var(--oxblood)', borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 8, position: 'relative', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Dropdown label={genders.length ? (genders.length === 1 ? genders[0] : `${genders.length} sections`) : 'For'} openKey="gender" open={open} setOpen={setOpen} active={genders.length}>
              {GENDERS.map(g => (
                <label key={g} style={optStyle}>
                  <input type="checkbox" checked={genders.includes(g)} onChange={() => toggle(genders, setGenders, g)} /> {g}
                </label>
              ))}
            </Dropdown>
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
            <Dropdown label={colors.length ? (colors.length === 1 ? colors[0] : `${colors.length} colors`) : 'Color'} openKey="color" open={open} setOpen={setOpen} active={colors.length}>
              {COLORS.map(c => (
                <label key={c} style={optStyle}>
                  <input type="checkbox" checked={colors.includes(c)} onChange={() => toggle(colors, setColors, c)} /> {c}
                </label>
              ))}
            </Dropdown>
            <Dropdown label={availFrom && availTo ? `${availFrom} → ${availTo}` : 'Dates'} openKey="avail" open={open} setOpen={setOpen} active={availFrom && availTo}>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>Only show items free for these dates</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="date" value={availFrom} min={new Date().toISOString().slice(0, 10)} onChange={e => setAvailFrom(e.target.value)} style={{ padding: 8, border: '1px solid var(--line)', borderRadius: 4, fontSize: 12.5 }} />
                <input type="date" value={availTo} min={availFrom || new Date().toISOString().slice(0, 10)} onChange={e => setAvailTo(e.target.value)} style={{ padding: 8, border: '1px solid var(--line)', borderRadius: 4, fontSize: 12.5 }} />
                {(availFrom || availTo) && (
                  <button onClick={() => { setAvailFrom(''); setAvailTo(''); }} style={{ fontSize: 11.5, color: 'var(--ink-faint)', textDecoration: 'underline', alignSelf: 'flex-start' }}>Clear</button>
                )}
              </div>
            </Dropdown>
            <Dropdown label={DISTANCES.find(d => d.value === maxDistance)?.label || 'Distance'} openKey="distance" open={open} setOpen={setOpen} active={maxDistance !== null}>
              {DISTANCES.map(d => (
                <label key={d.label} style={optStyle}>
                  <input type="radio" name="distance" checked={maxDistance === d.value} onChange={() => setMaxDistance(d.value)} /> {d.label}
                </label>
              ))}
            </Dropdown>
          </div>
          <Dropdown label={`Sort: ${SORTS.find(s => s.value === sortBy)?.label}`} openKey="sort" open={open} setOpen={setOpen} active={sortBy !== 'newest'}>
            {SORTS.map(s => (
              <label key={s.value} style={{ ...optStyle, opacity: s.value === 'distance' && locationStatus !== 'granted' ? 0.4 : 1 }}>
                <input
                  type="radio" name="sort" checked={sortBy === s.value}
                  disabled={s.value === 'distance' && locationStatus !== 'granted'}
                  onChange={() => setSortBy(s.value)}
                /> {s.label}
              </label>
            ))}
          </Dropdown>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '26px 20px' }}>
        {!loading && sortedListings.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px 20px', color: 'var(--ink-faint)' }}>
            <div className="serif" style={{ fontSize: 19, color: 'var(--ink-soft)' }}>No pieces match those filters</div>
          </div>
        )}
        {sortedListings.map(l => (
          <div
            key={l.id}
            onClick={() => router.push(`/listings/${l.id}`)}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
          >
            <div style={{ position: 'relative' }}>
              <PhotoTile url={l.photo_url} style={{ aspectRatio: '3/4', borderRadius: 2 }} />
              {isNew(l.created_at) && (
                <span style={{ position: 'absolute', top: 8, left: 8, fontSize: 10.5, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: 'var(--sage-bg)', color: 'var(--sage-ink)' }}>
                  NEW
                </span>
              )}
              <button
                onClick={e => toggleFavorite(e, l.id)}
                style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(253,251,245,0.92)', border: 'none', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
              {l.distance_from_you != null && (
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                  {l.distance_from_you < 0.1 ? 'Very close' : `${l.distance_from_you.toFixed(1)} mi away`}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: 30 }}>
          <button className="btn btn-ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
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
