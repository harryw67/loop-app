'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import TermsModal from '@/components/TermsModal';

export default function ListingDetail({ params }) {
  const [listing, setListing] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [me, setMe] = useState(null);
  const [favorited, setFavorited] = useState(false);
  const [avgRating, setAvgRating] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [booked, setBooked] = useState([]);
  const [showTerms, setShowTerms] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);
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

        const { data: existingRentals } = await supabase
          .from('rentals')
          .select('start_date, end_date')
          .eq('listing_id', params.id)
          .in('stage', ['pending', 'booked', 'handoff', 'out', 'return'])
          .not('start_date', 'is', null);
        setBooked(existingRentals || []);
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
  const photos = listing.photos?.length ? listing.photos : (listing.photo_url ? [listing.photo_url] : []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, maxWidth: 780, margin: '0 auto' }}>
      <div>
        <div style={{ aspectRatio: '3/4', background: photos[photoIdx] ? `url(${photos[photoIdx]}) center/cover` : 'var(--cream-2)', borderRadius: 4, position: 'relative' }}>
          <button onClick={toggleFavorite} style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', background: 'rgba(246,242,233,0.92)', border: 'none', fontSize: 17 }}>
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
          Listed by {listing.profiles?.full_name || 'a student'} · size {listing.size}
          {avgRating && <span style={{ color: 'var(--mustard-ink)' }}> · {avgRating}★ ({reviewCount})</span>}
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-soft)', lineHeight: 1.6, marginTop: 16 }}>{listing.description}</p>
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
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
                Already booked: {booked.map((b, i) => `${b.start_date}–${b.end_date}`).join(', ')}
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
  );
}
