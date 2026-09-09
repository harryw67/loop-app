'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { formatDateShort } from '@/lib/dates';
import { compressImage } from '@/lib/imageCompress';
import { getCurrentPosition, midpoint } from '@/lib/location';

const STAGES = ['inquiry', 'pending', 'booked', 'out', 'return', 'settled'];
const EXCEPTION_STAGES = ['declined', 'cancelled', 'disputed', 'no_show', 'expired'];
const STAGE_LABEL = { inquiry: 'Inquiry', pending: 'Pending', booked: 'Booked', out: 'With renter', return: 'Return', settled: 'Settled', declined: 'Declined', disputed: 'Disputed', no_show: 'No-show', expired: 'Expired', cancelled: 'Cancelled' };
const ONE_HOUR_MS = 60 * 60 * 1000;

export default function RentalThread({ params }) {
  const router = useRouter();
  const [rental, setRental] = useState(null);
  const [events, setEvents] = useState([]);
  const [me, setMe] = useState(null);
  const [text, setText] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [banner, setBanner] = useState('');
  const [myReview, setMyReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [hasCard, setHasCard] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [renterStats, setRenterStats] = useState(null);
  const [ownerPayoutReady, setOwnerPayoutReady] = useState(true);
  const [noShowDisputeReason, setNoShowDisputeReason] = useState('');
  const [meetupSpot, setMeetupSpot] = useState(null);
  const [meetupStatus, setMeetupStatus] = useState('idle');
  const sendingRef = useRef(false);
  const bodyRef = useRef(null);

  const load = async () => {
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setMe(user);

    const { data: r, error } = await supabase.from('rentals')
      .select('*, listings(*), owner:owner_id(full_name), renter:renter_id(full_name)')
      .eq('id', params.id).maybeSingle();
    if (error || !r || (r.owner_id !== user.id && r.renter_id !== user.id)) { setNotFound(true); return; }
    setRental(r);

    const res = await fetch(`/api/rentals/${params.id}/events`);
    const d = await res.json();
    setEvents(d.events || []);

    if (r.stage === 'settled' || r.stage === 'disputed' || r.stage === 'no_show') {
      const { data: review } = await supabase.from('reviews').select('*').eq('rental_id', r.id).eq('reviewer_id', user.id).maybeSingle();
      setMyReview(review);
    }

    if (r.renter_id === user.id && (r.stage === 'pending' || r.stage === 'booked')) {
      fetch('/api/stripe/payment-method-status').then(res => res.json()).then(d => setHasCard(!!d.hasCard));
    }

    // owner should see the renter's reliability before deciding to approve
    if (r.owner_id === user.id && r.stage === 'pending') {
      const { data: reviews } = await supabase.from('reviews').select('rating').eq('reviewee_id', r.renter_id);
      const { data: renterProfile } = await supabase.from('profiles').select('no_show_count, cancellation_count').eq('id', r.renter_id).single();
      setRenterStats({
        avgRating: reviews?.length ? (reviews.reduce((s, x) => s + x.rating, 0) / reviews.length).toFixed(1) : null,
        reviewCount: reviews?.length || 0,
        noShows: renterProfile?.no_show_count || 0,
        cancellations: renterProfile?.cancellation_count || 0,
      });
      fetch('/api/stripe/connect-status').then(res => res.json()).then(d => setOwnerPayoutReady(!!d.payoutsEnabled));
    }
  };

  useEffect(() => { load(); }, [params.id]);
  useEffect(() => { bodyRef.current?.scrollTo(0, 999999); }, [events]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  // poll for updates from the other party — without this, if the other
  // person cancels, approves, or confirms something, your screen won't
  // reflect it until you manually reload
  useEffect(() => { const t = setInterval(() => load(), 6000); return () => clearInterval(t); }, [params.id]);

  if (notFound) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-faint)' }}>
        <div className="serif" style={{ fontSize: 19, color: 'var(--ink-soft)', marginBottom: 6 }}>Conversation not found</div>
        <a href="/rentals" style={{ color: 'var(--oxblood)' }}>Back to my rentals</a>
      </div>
    );
  }

  if (!rental || !me) return <p style={{ color: 'var(--ink-faint)' }}>Loading…</p>;

  const isOwner = rental.owner_id === me.id;
  const role = isOwner ? 'owner' : 'renter';
  const other = isOwner ? rental.renter : rental.owner;
  const otherId = isOwner ? rental.renter_id : rental.owner_id;

  const post = async (payload) => {
    if (sendingRef.current) return; // prevents duplicate sends from rapid/double clicks
    sendingRef.current = true;
    setBanner('');
    try {
      const res = await fetch(`/api/rentals/${params.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) setBanner(data.error || `Something went wrong (${res.status}) — try again.`);
    } catch (err) {
      setBanner('Could not reach the server — check your connection and try again.');
    }
    await load();
    sendingRef.current = false;
  };

  const sendMessage = () => {
    if (!text.trim()) return;
    post({ kind: 'message', text });
    setText('');
  };

  const submitCode = () => {
    if (codeInput.trim().length !== 4) { setBanner('Enter the 4-digit code the owner shows you.'); return; }
    post({ kind: 'code_confirmed', code: codeInput.trim() });
    setCodeInput('');
  };

  const uploadPhoto = async (phase, side, rawFile) => {
    setBanner('');
    const file = await compressImage(rawFile);
    const supabase = supabaseBrowser();
    const path = `${me.id}/${rental.id}-${phase}-${side}-${Date.now()}`;
    const { error } = await supabase.storage.from('photos').upload(path, file);
    if (error) { setBanner(error.message); return; }
    const url = supabase.storage.from('photos').getPublicUrl(path).data.publicUrl;
    post({ kind: 'photo', phase, side, url });
  };

  const submitReview = async () => {
    setBanner('');
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rental_id: rental.id, rating: reviewRating, comment: reviewComment }),
    });
    const data = await res.json();
    if (!res.ok) { setBanner(data.error); return; }
    setMyReview(data.review);
  };

  const reportUser = async () => {
    const reason = prompt(`What happened with ${other?.full_name}?`);
    if (!reason) return;
    await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reported_user_id: otherId, rental_id: rental.id, reason }),
    });
    setBanner('Report sent — thanks for flagging it.');
  };

  const blockUser = async () => {
    if (!confirm(`Block ${other?.full_name}? Their listings will stop showing up for you.`)) return;
    await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked_id: otherId }),
    });
    setBanner(`Blocked ${other?.full_name}.`);
  };

  const suggestMeetupSpot = async () => {
    setMeetupStatus('requesting');
    try {
      const pos = await getCurrentPosition();
      const ownerLat = rental.listings.lat, ownerLng = rental.listings.lng;
      if (ownerLat == null || ownerLng == null) { setMeetupStatus('no-owner-location'); return; }
      const mid = midpoint(pos.lat, pos.lng, ownerLat, ownerLng);
      setMeetupSpot(mid);
      setMeetupStatus('done');
    } catch {
      setMeetupStatus('denied');
    }
  };

  const shareMeetupSpot = () => {
    if (!meetupSpot) return;
    const link = `https://www.google.com/maps?q=${meetupSpot.lat},${meetupSpot.lng}`;
    post({ kind: 'message', text: `How about meeting around here, roughly halfway for both of us: ${link}` });
  };

  const suggestPlace = (name) => {
    post({ kind: 'message', text: `Want to meet at the ${name}?` });
  };

  const cancelBooking = () => {
    if (confirm('Cancel this booking? Any payment hold will be released.')) {
      post({ kind: 'cancel' });
    }
  };

  const disputeNoShow = () => {
    if (!noShowDisputeReason.trim()) { setBanner('Explain what happened before submitting.'); return; }
    post({ kind: 'dispute_no_show', reason: noShowDisputeReason.trim() });
    setNoShowDisputeReason('');
  };

  const preexistingPhotos = events.filter(e => e.kind === 'photo' && e.payload?.phase === 'preexisting');
  const windowMsLeft = rental.handoff_confirmed_at ? ONE_HOUR_MS - (now - new Date(rental.handoff_confirmed_at).getTime()) : 0;
  const windowOpen = rental.handoff_confirmed_at && windowMsLeft > 0;
  const minutesLeft = Math.max(0, Math.ceil(windowMsLeft / 60000));

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EXCEPTION_STAGES.includes(rental.stage) ? (
            <span