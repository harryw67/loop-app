'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PhotoTile from '@/components/PhotoTile';

const STAGE_LABEL = { inquiry: 'Inquiry', pending: 'Pending', booked: 'Booked', out: 'With renter', return: 'Return', settled: 'Settled', declined: 'Declined', disputed: 'Disputed', cancelled: 'Cancelled', no_show: 'No-show', expired: 'Expired' };
const DONE_STAGES = ['settled'];
const BAD_STAGES = ['cancelled', 'declined', 'no_show', 'expired', 'disputed'];

export default function RentalsPage() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rentals').then(r => r.json()).then(d => setRentals(d.rentals || [])).finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: 'var(--ink-faint)' }}>Loading…</p>;

  if (rentals.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-faint)' }}>
        <div className="serif" style={{ fontSize: 19, color: 'var(--ink-soft)', marginBottom: 6 }}>No rentals yet</div>
        <div>Browse pieces to book your first rental.</div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 22 }}>My rentals</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
        {rentals.map(r => (
          <Link key={r.id} href={`/rentals/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ background: 'var(--white)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 56, flexShrink: 0 }}><PhotoTile url={r.listings?.photo_url} style={{ width: '100%', height: '100%' }} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500 }}>{r.listings?.name}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 2 }}>
                  with {r.owner?.full_name || r.renter?.full_name} · {STAGE_LABEL[r.stage] || r.stage}
                </div>
              </div>
              <span style={{
                fontSize: 11.5, padding: '4px 10px', borderRadius: 999, fontWeight: 500,
                background: DONE_STAGES.includes(r.stage) ? 'var(--sage-bg)' : BAD_STAGES.includes(r.stage) ? 'var(--oxblood-bg)' : 'var(--mustard-bg)',
                color: DONE_STAGES.includes(r.stage) ? 'var(--sage-ink)' : BAD_STAGES.includes(r.stage) ? 'var(--oxblood-ink)' : 'var(--mustard-ink)',
              }}>
                {STAGE_LABEL[r.stage] || r.stage}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
