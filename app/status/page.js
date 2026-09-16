'use client';
import { useEffect, useState } from 'react';

export default function StatusPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const check = () => {
    setLoading(true);
    fetch('/api/status').then(r => r.json()).then(setStatus).finally(() => setLoading(false));
  };

  useEffect(() => { check(); }, []);

  const services = status ? [
    { name: 'Website', ok: true, ms: null },
    { name: 'Database', ok: status.database.ok, ms: status.database.ms },
    { name: 'Payments', ok: status.payments.ok, ms: status.payments.ms },
  ] : [];

  const allOk = services.every(s => s.ok);

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 6 }}>Loop Status</h1>
      <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 24 }}>
        Live check of the systems Loop depends on, run when this page loads.
      </p>

      {loading ? (
        <p style={{ color: 'var(--ink-faint)' }}>Checking…</p>
      ) : (
        <>
          <div style={{
            padding: '10px 14px', borderRadius: 6, marginBottom: 20, fontSize: 13.5, fontWeight: 500,
            background: allOk ? 'var(--sage-bg)' : 'var(--oxblood-bg)',
            color: allOk ? 'var(--sage-ink)' : 'var(--oxblood-ink)',
          }}>
            {allOk ? 'All systems operational' : 'Some systems are having issues'}
          </div>

          {services.map(s => (
            <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.ok ? 'var(--sage)' : 'var(--oxblood)' }} />
                <span style={{ fontSize: 14 }}>{s.name}</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                {s.ok ? 'Operational' : 'Issue detected'}{s.ms != null && ` · ${s.ms}ms`}
              </span>
            </div>
          ))}

          <button className="btn btn-ghost" style={{ marginTop: 20, fontSize: 12.5 }} onClick={check}>Check again</button>
        </>
      )}
    </div>
  );
}
