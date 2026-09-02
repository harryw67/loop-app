'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

const STAGES = ['inquiry', 'pending', 'booked', 'out', 'return', 'settled'];
const STAGE_LABEL = { inquiry: 'Inquiry', pending: 'Pending', booked: 'Booked', out: 'With renter', return: 'Return', settled: 'Settled', declined: 'Declined', disputed: 'Disputed' };
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

    if (r.stage === 'settled') {
      const { data: review } = await supabase.from('reviews').select('*').eq('rental_id', r.id).eq('reviewer_id', user.id).maybeSingle();
      setMyReview(review);
    }

    if (r.renter_id === user.id && r.stage === 'booked') {
      fetch('/api/stripe/payment-method-status').then(res => res.json()).then(d => setHasCard(!!d.hasCard));
    }
  };

  useEffect(() => { load(); }, [params.id]);
  useEffect(() => { bodyRef.current?.scrollTo(0, 999999); }, [events]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

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
    setBanner('');
    const res = await fetch(`/api/rentals/${params.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) setBanner(data.error || 'Something went wrong — try again.');
    await load();
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

  const uploadPhoto = async (phase, side, file) => {
    setBanner('');
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

  const preexistingPhotos = events.filter(e => e.kind === 'photo' && e.payload?.phase === 'preexisting');
  const windowMsLeft = rental.handoff_confirmed_at ? ONE_HOUR_MS - (now - new Date(rental.handoff_confirmed_at).getTime()) : 0;
  const windowOpen = rental.handoff_confirmed_at && windowMsLeft > 0;
  const minutesLeft = Math.max(0, Math.ceil(windowMsLeft / 60000));

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STAGES.map((s, i) => {
            const cur = STAGES.indexOf(rental.stage);
            const cls = i < cur ? { background: 'var(--sage-bg)', borderColor: 'var(--sage)', color: 'var(--sage-ink)' }
              : i === cur ? { background: 'var(--mustard-bg)', borderColor: 'var(--mustard)', color: 'var(--mustard-ink)' }
              : { borderColor: 'var(--line)', color: 'var(--ink-faint)' };
            return <span key={s} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, border: '1px solid', ...cls }}>{STAGE_LABEL[s]}</span>;
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={reportUser} style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Report</button>
          <button onClick={blockUser} style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>Block</button>
        </div>
      </div>

      {banner && (
        <div style={{ background: 'var(--oxblood-bg)', color: 'var(--oxblood-ink)', border: '1px solid var(--oxblood)', borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>
          {banner}
        </div>
      )}

      <div style={{ border: '1px solid var(--line)', borderRadius: 4, background: 'var(--white)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ fontSize: 14.5, fontWeight: 500 }}>{other?.full_name} · {rental.listings.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
            ${(rental.listings.price_cents / 100).toFixed(0)}/day · ${(rental.listings.deposit_cents / 100).toFixed(0)} deposit
            {rental.start_date && ` · ${rental.start_date} to ${rental.end_date}`}
          </div>
        </div>

        <div ref={bodyRef} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '56vh', overflowY: 'auto' }}>
          {events.filter(e => e.payload?.phase !== 'preexisting').map(ev => <EventBubble key={ev.id} ev={ev} me={me} />)}

          {rental.stage === 'inquiry' && !isOwner && (
            <SysBlock label="Just messaging for now — pick dates when you're ready to book">
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input type="date" value={reqStartDate} min={new Date().toISOString().slice(0, 10)} onChange={e => setReqStartDate(e.target.value)} style={{ flex: 1, padding: 8, border: '1px solid var(--line)', borderRadius: 4, fontSize: 12.5 }} />
                <input type="date" value={reqEndDate} min={reqStartDate || new Date().toISOString().slice(0, 10)} onChange={e => setReqEndDate(e.target.value)} style={{ flex: 1, padding: 8, border: '1px solid var(--line)', borderRadius: 4, fontSize: 12.5 }} />
              </div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!reqStartDate || !reqEndDate) { setBanner('Pick a start and end date first.'); return; }
                  post({ kind: 'request_to_rent', start_date: reqStartDate, end_date: reqEndDate });
                }}
              >
                Request to rent
              </button>
            </SysBlock>
          )}
          {rental.stage === 'inquiry' && isOwner && (
            <SysBlock label="This renter is asking a question before booking" />
          )}

          {rental.stage === 'pending' && isOwner && (
            <SysBlock label="This renter wants to book — approve or decline">
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => post({ kind: 'approve' })}>Approve</button>
                <button className="btn btn-ghost" onClick={() => post({ kind: 'decline' })}>Decline</button>
              </div>
            </SysBlock>
          )}
          {rental.stage === 'pending' && !isOwner && (
            <SysBlock label="Waiting on the owner to approve your request" />
          )}
          {rental.stage === 'declined' && (
            <SysBlock label="This request was declined" />
          )}

          {rental.stage === 'booked' && isOwner && (
            <SysBlock label="Your handoff code — share it in person when you meet up" confirmed>
              <div style={{ fontSize: 34, fontFamily: 'Fraunces, serif', fontWeight: 600, letterSpacing: 6 }}>{rental.qr_token}</div>
            </SysBlock>
          )}
          {rental.stage === 'booked' && !isOwner && (
            <SysBlock label="Meet up, then enter the code the owner shows you">
              {!hasCard && (
                <p style={{ fontSize: 11.5, color: 'var(--oxblood)', marginBottom: 10 }}>
                  You'll need a card on file first — <a href="/payment-method" style={{ color: 'var(--oxblood)' }}>add one here</a>.
                </p>
              )}
              <input
                placeholder="4-digit code"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                style={{ width: '100%', marginBottom: 8, padding: 8, border: '1px solid var(--line)', borderRadius: 4, fontSize: 20, textAlign: 'center', letterSpacing: 4 }}
              />
              <button className="btn btn-primary" onClick={submitCode}>Confirm handoff</button>
            </SysBlock>
          )}

          {rental.stage === 'out' && !isOwner && windowOpen && (
            <SysBlock label={`Notice anything already wrong? Document it — closes in ${minutesLeft} min`}>
              <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 10 }}>The owner's listing photos are the baseline — this is just your chance to flag anything that doesn't match before you wear it.</p>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                {preexistingPhotos.map((p, i) => <img key={i} src={p.payload.url} style={{ width: 44, height: 44, borderRadius: 4, objectFit: 'cover' }} />)}
              </div>
              <PhotoPicker onPick={file => uploadPhoto('preexisting', preexistingPhotos.length % 2 === 0 ? 'front' : 'back', file)} label="Add photo" />
            </SysBlock>
          )}
          {rental.stage === 'out' && isOwner && (
            <button className="btn btn-ghost" onClick={() => post({ kind: 'message', text: "Ready whenever you are to return it — I'll send the return step." })}>
              Nudge about return
            </button>
          )}

          {rental.stage === 'return' && (
            <SysBlock label="Condition photos — at return">
              <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 10 }}>Wash or dry-clean the item before returning it — that's part of what you agreed to.</p>
              <PhotoPicker onPick={file => uploadPhoto('after', 'front', file)} label="Front" />
              <PhotoPicker onPick={file => uploadPhoto('after', 'back', file)} label="Back" />
              <ConfirmRow
                phase="return" role={role} confirmed={confirmsFor(events, 'return')}
                onConfirm={() => post({ kind: 'confirm', phase: 'return' })}
              />
              <button style={{ fontSize: 12, color: 'var(--oxblood)', marginTop: 10 }} onClick={() => { const reason = prompt("What doesn't match?"); if (reason) post({ kind: 'dispute', reason }); }}>
                Something doesn't match — raise a dispute
              </button>
            </SysBlock>
          )}

          {rental.stage === 'settled' && (
            <SysBlock label={myReview ? 'Your review' : `How was renting with ${other?.full_name}?`} confirmed>
              {myReview ? (
                <div style={{ fontSize: 13 }}>{'★'.repeat(myReview.rating)}{'☆'.repeat(5 - myReview.rating)} {myReview.comment && <div style={{ marginTop: 4, color: 'var(--ink-soft)' }}>{myReview.comment}</div>}</div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 8, fontSize: 22 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <span key={n} onClick={() => setReviewRating(n)} style={{ cursor: 'pointer', color: n <= reviewRating ? 'var(--mustard-ink)' : 'var(--line)' }}>★</span>
                    ))}
                  </div>
                  <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} placeholder="Optional note" style={{ width: '100%', padding: 8, border: '1px solid var(--line)', borderRadius: 4, fontSize: 13, minHeight: 50, marginBottom: 8 }} />
                  <button className="btn btn-primary" onClick={submitReview}>Leave review</button>
                </div>
              )}
            </SysBlock>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
          <input
            style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 20, padding: '9px 14px', fontSize: 13.5, background: 'var(--cream)' }}
            placeholder={`Message ${other?.full_name || ''}`}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <button style={{ fontSize: 13, color: 'var(--oxblood)', fontWeight: 500 }} onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

function confirmsFor(events, phase) {
  return events.filter(e => e.kind === 'confirm' && e.payload?.phase === phase).map(e => e.payload.role);
}

function EventBubble({ ev, me }) {
  if (ev.kind === 'message') {
    const mine = ev.actor_id === me.id;
    return (
      <div style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '74%', padding: '9px 13px', borderRadius: 14, fontSize: 13.5, background: mine ? 'var(--oxblood-bg)' : 'var(--cream-2)', color: mine ? 'var(--oxblood-ink)' : 'var(--ink)' }}>
        {ev.payload.text}
      </div>
    );
  }
  if (ev.kind === 'code_confirmed') return <SysBlock label="Handoff code confirmed — both parties present" confirmed />;
  if (ev.kind === 'payment_released') return <SysBlock label="Payment released to the owner" confirmed />;
  if (ev.kind === 'deposit_refunded') return <SysBlock label="Deposit refunded — return photos matched" confirmed />;
  if (ev.kind === 'dispute') return <SysBlock label={`Dispute raised: ${ev.payload.reason || 'condition mismatch'}`} />;
  return null;
}

function SysBlock({ label, confirmed, children }) {
  return (
    <div style={{ alignSelf: 'center', width: '92%', background: confirmed ? 'var(--sage-bg)' : 'var(--cream-2)', border: `1px solid ${confirmed ? 'var(--sage)' : 'var(--line)'}`, borderRadius: 6, padding: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: confirmed ? 'var(--sage-ink)' : 'var(--ink-soft)', marginBottom: children ? 8 : 0 }}>{label}</div>
      {children}
    </div>
  );
}

function PhotoPicker({ onPick, label }) {
  return (
    <label style={{ display: 'inline-block', padding: '8px 14px', borderRadius: 4, border: '1px dashed var(--line)', margin: '0 4px', fontSize: 12, color: 'var(--ink-faint)', cursor: 'pointer' }}>
      {label}
      <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files[0] && onPick(e.target.files[0])} />
    </label>
  );
}

function ConfirmRow({ phase, role, confirmed, onConfirm }) {
  const iConfirmed = confirmed.includes(role);
  const otherRole = role === 'owner' ? 'renter' : 'owner';
  const otherConfirmed = confirmed.includes(otherRole);
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, background: otherConfirmed ? 'var(--sage-bg)' : 'var(--cream)', color: otherConfirmed ? 'var(--sage-ink)' : 'var(--ink-faint)', border: '1px solid var(--line)' }}>
          {otherRole} {otherConfirmed ? 'confirmed ✓' : 'waiting'}
        </span>
        <span style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, background: iConfirmed ? 'var(--sage-bg)' : 'var(--cream)', color: iConfirmed ? 'var(--sage-ink)' : 'var(--ink-faint)', border: '1px solid var(--line)' }}>
          you {iConfirmed ? 'confirmed ✓' : ''}
        </span>
      </div>
      {!iConfirmed && <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={onConfirm}>I confirm this</button>}
    </div>
  );
}
