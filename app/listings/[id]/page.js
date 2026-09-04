'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import TermsModal from '@/components/TermsModal';
import PhotoTile from '@/components/PhotoTile';
import { formatDateShort } from '@/lib/dates';

const RECENT_KEY = 'loop_recent';

export default function ListingDetail({ params }) {
  const [listing, setListing] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [me, setMe] = useState(null);
  const [favorited, setFavorited] = useState(false);
  const [avgRating, setAvgRating] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [ownerNoShows, setOwnerNoShows] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [booked, setBooked] = useState([]);
  const [showTerms, setShowTerms] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);
  const [similar, setSimilar] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => setMe(user));

    supabase.from('listings').select('*, profiles(full_name)').eq('id', params.id).eq('active', true).maybeSingle()
      .then(async ({ data, error }) => {
        if (error || !data) { setNotFound(true); setLoading(false); return; }
        setListing(data);
        setLoading(false);

        const { data: reviews } = await supabase.from('reviews').select('rating').eq('reviewee_id', data.owner_id);
        if (reviews?.length) {
          setAvgRating((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1));
          setReviewCount(reviews.length);
        }

        const { data: ownerProfile } = await supabase.from('profiles').select('no_show_count').eq('id', data.owner_id).single();
        setOwnerNoShows(ownerProfile?.no_show_count || 0);

        const { data: existingRentals } = await supabase
          .from('rentals')
          .select('start_date, end_date')
          .eq('listing_id', params.id)
          .in('stage', ['pending', 'booked', 'handoff', 'out', 'return'])
          .not('start_date', 'is', null);
        setBooked(existingRentals || []);

        // similar items — same category, excluding this one
        const { data: similarItems } = await supabase
          .from('listings').select('*, profiles(full_name)')
          .eq('category', data.category).eq('active', true).neq('id', params.id).limit(4);
        setSimilar(similarItems || []);

        // recently viewed — track this item, then load the others
        try {
          const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
          const updated = [params.id, ...raw.filter(id => id !== params.id)].slice(0, 8);
          localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
          const otherIds = updated.filter(id => id !== params.id);
          if (otherIds.length) {
            const { data: recent } = await supabase.from('listings').select('*, profiles(full_name)').in('id', otherIds).eq('active', true);
            const ordered = otherIds.map(id => recent?.find(r => r.id === id)).filter(Boolean).slice(0, 4);
            setRecentlyViewed(ordered);
          }
        } catch {}
      });

    fetch('/api/favorites').then(r => r.ok ? r.json() : { favorites: [] })
      .then(d => setFavorited((d.favorites || []).some(f => f.listing_id === params.id)))
      .catch(() => {});
  }, [params.id]);

  const start = async (mode) => {
    setError('');
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    if (mode === 'book') {
      if (!startDate || !endDate) { setError('Pick a start and end date first.'); return; }
      if (endDate < startDate) { setError('End date is before the start date.'); return; }
    }

    const { data: profile } = await supabase.from('profiles').select('agreed_terms_at').eq('id', user.id).single();
    if (!profile?.agreed_terms_at) { setPendingMode(mode); setShowTerms(true); return; }

    await doStart(mode);
  };

  const doStart = async (mode) => {
    const res = await fetch('/api/rentals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: params.id, mode, start_date: startDate, end_date: endDate }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    router.push(`/rentals/${data.rental.id}`);
  };

  const toggleFavorite = async () => {
    if (!me) { router.push('/login'); return; }
    const res = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ listing_id: params.id }) });
    const data = await res.json();
    setFavorited(data.favorited);
  };

  const deleteListing = async () => {
    if (!confirm('Take this listing down? It will no longer show up in Browse.')) return;
    const res = await fetch(`/api/listings/${params.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/listings/new');
    else setError('Could not delete this listing.');
  };

  if (loading) return <p style={{ color: 'var(--ink-faint)' }}>Loading…</p>;

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-faint)' }}>
        <div className="serif" style={{ fontSize: 19, color: 'var(--ink-soft)', marginBottom: 6 }}>Listing not found</div>
        <div>It may have been taken down. <a href="/" style={{ color: 'var(--oxblood)' }}>Back to browse</a></div>
      </div>
    );
  }

  const isOwner = me && listing.owner_id === me.id;

  const today = new Date().toISOString().slice(0, 10);
  const currentBooking = booked.find(b => b.start_date <= today && b.end_date >= today);
  const nextBooking = booked.filter(b => b.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  const availabilityBadge = currentBooking
    ? { bookedNow: true, text: `Booked until ${formatDateShort(currentBooking.end_date)}` }
    : nextBooking
    ? { bookedNow: false, text: `Available now — booked ${formatDateShort(nextBooking.start_date)}–${formatDateShort(nextBooking.end_date)} later` }
    : null;
  const photos = listing.photos?.length ? listing.photos : (listing.photo_url ? [listing.photo_url] : []);

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
    <div className="listing-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
      <div>
        <div style={{ aspectRatio: '3/4', borderRadius: 4, position: 'relative' }}>
          <PhotoTile url={photos[photoIdx]} style={{ position: 'absolute', inset: 0, borderRadius: 4 }} />
          <button onClick={toggleFavorite} style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', background: 'rgba(253,251,245,0.92)', border: 'none', fontSize: 17 }}>
            {favorited ? '★' : '☆'}
          </button>
        </div>
        {photos.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {photos.map((p, i) => (
              <div key={i} onClick={() => setPhotoIdx(i)} style={{ width: 56, height: 56, borderRadius: 4, cursor: 'pointer', background: `url(${p}) center/cover`, border: i === photoIdx ? '2px solid var(--oxblood)' : '2px solid transparent' }} />
            ))}
          </div>
        )}
      </div>
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 500 }}>{listing.name}</h2>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>
          Listed by {listing.profiles?.full_name || 'a student'} · size {listing.size}{listing.color && ` · ${listing.color}`}
          {avgRating && <span style={{ color: 'var(--mustard-ink)' }}> · {avgRating}★ ({reviewCount})</span>}
          {ownerNoShows > 0 && <span style={{ color: 'var(--oxblood)' }}> · {ownerNoShows} no-show{ownerNoShows === 1 ? '' : 's'}</span>}
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, marginTop: 16 }}>{listing.description}</p>
        {listing.care_instructions && (
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 8 }}>
            <b style={{ color: 'var(--ink-soft)' }}>Care:</b> {listing.care_instructions}
          </p>
        )}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
          {availabilityBadge && (
            <span style={{
              display: 'inline-block', fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 999, marginBottom: 10,
              background: availabilityBadge.bookedNow ? 'var(--oxblood-bg)' : 'var(--sage-bg)',
              color: availabilityBadge.bookedNow ? 'var(--oxblood-ink)' : 'var(--sage-ink)',
            }}>
              {availabilityBadge.text}
            </span>
          )}
          <span style={{ fontSize: 26, fontFamily: 'Fraunces, serif', fontWeight: 500 }}>${(listing.price_cents / 100).toFixed(0)}</span>
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}> / day</span>
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 6 }}>
            ${(listing.deposit_cents / 100).toFixed(0)} refundable deposit, held until return
          </div>
        </div>
        {error && <p style={{ color: 'var(--oxblood)', fontSize: 12.5, marginTop: 12 }}>{error}</p>}

        {isOwner ? (
          <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => router.push(`/listings/${params.id}/edit`)}>Edit listing</button>
            <button className="btn btn-ghost" style={{ flex: 1, color: 'var(--oxblood)' }} onClick={deleteListing}>Take down</button>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <div className="field" style={{ flex: 1 }}>
                <label>Start date</label>
                <input type="date" value={startDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>End date</label>
                <input type="date" value={endDate} min={startDate || new Date().toISOString().slice(0, 10)} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>
            {booked.length > 0 && (
              <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>
                Already booked: {booked.map((b, i) => `${formatDateShort(b.start_date)}–${formatDateShort(b.end_date)}`).join(', ')}
              </p>
            )}
            <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={() => start('book')}>Request to rent</button>
            <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => start('inquiry')}>Message the owner first</button>
          </>
        )}
      </div>

      {showTerms && (
        <TermsModal
          onAgree={() => { setShowTerms(false); doStart(pendingMode); }}
          onCancel={() => setShowTerms(false)}
        />
      )}
    </div>

    {similar.length > 0 && (
      <ListingStrip title="Similar items" items={similar} onOpen={id => router.push(`/listings/${id}`)} />
    )}
    {recentlyViewed.length > 0 && (
      <ListingStrip title="Recently viewed" items={recentlyViewed} onOpen={id => router.push(`/listings/${id}`)} />
    )}
    </div>
  );
}

function ListingStrip({ title, items, onOpen }) {
  return (
    <div style={{ marginTop: 44 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
        {title}
      </div>
      <div className="strip-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {items.map(l => (
          <div key={l.id} onClick={() => onOpen(l.id)} style={{ cursor: 'pointer' }}>
            <PhotoTile url={l.photo_url} style={{ aspectRatio: '3/4', borderRadius: 2 }} />
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500 }}>{l.name}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>${(l.price_cents / 100).toFixed(0)}/day</div>
          </div>
        ))}
      </div>
    </div>
  );
}
