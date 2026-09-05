'use client';

const STEPS = [
  { title: 'Browse & book', body: "Find something, pick your dates, and either message the owner or request to rent. They'll approve it before anything else happens." },
  { title: 'Meet & confirm', body: 'Meet up in person. The owner shows you a 4-digit code — enter it to confirm the handoff, which is what actually charges your card and holds your deposit.' },
  { title: 'Return & refund', body: "Wash it, return it by the date you agreed on, both confirm the return, and your deposit refunds automatically." },
];

export default function IntroModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(34,30,25,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}>
      <div style={{ background: 'var(--white)', borderRadius: 6, maxWidth: 440, width: '100%', padding: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 18 }}>How Loop works</h2>
        {STEPS.map((s, i) => (
          <div key={s.title} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--oxblood-bg)', color: 'var(--oxblood-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
              {i + 1}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 2 }}>{s.body}</div>
            </div>
          </div>
        ))}
        <button className="btn btn-primary btn-block" style={{ marginTop: 6 }} onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
