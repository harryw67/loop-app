'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PhotoTile from '@/components/PhotoTile';

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/favorites')
      .then(r => { if (r.status === 401) { router.push('/login'); return { favorites: [] }; } return r.json(); })
      .then(d => setFavorites(d.favorites || []))
      .finally(() => setLoading(false));
  }, []);

  const unfavorite = async (e, listingId) => {
    e.stopPropagation(); // don't trigger the card's own click-through
    await fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    });
    setFavorites(prev => prev.filter(f => f.listing_id !== listingId));
  };

  if (loading) return <p style={{ color: 'var(--ink-faint)' }}>Loading…</p>;

  if (favorites.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-faint)' }}>
        <div className="serif" style={{ fontSize: 19, color: 'var(--ink-soft)', marginBottom: 6 }}>Nothing saved yet</div>
        <div>Tap the star on any listing to save it here.</div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 22 }}>Saved</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '26px 20px' }}>
        {favorites.map(f => {
          const l = f.listings;
          if (!l) return null;
          return (
            <div key={l.id} onClick={() => router.push(`/listings/${l.id}`)} style={{ cursor: 'pointer' }}>
              <div style={{ position: 'relative' }}>
                <PhotoTile url={l.photo_url} style={{ aspectRatio: '3/4', borderRadius: 2 }} />
                <button
                  onClick={(e) => unfavorite(e, l.id)}
                  title="Remove from saved"
                  style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: '50%', background: 'rgba(253,251,245,0.92)', border: 'none', fontSize: 15, cursor: 'pointer' }}
                >
                  ★
                </button>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{l.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 12.5 }}>
                  <span style={{ color: 'var(--ink-faint)' }}>{l.profiles?.full_name || 'Owner'}</span>
                  <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>${(l.price_cents / 100).toFixed(0)}/day</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
