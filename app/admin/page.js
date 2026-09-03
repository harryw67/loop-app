'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(null);
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return; }
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!p?.is_admin) { setAllowed(false); return; }
      setAllowed(true);
      load();
    });
  }, []);

  const load = async () => {
    fetch('/api/admin/reports').then(r => r.json()).then(d => setReports(d.reports || []));
    fetch('/api/admin/no-show-disputes').then(r => r.json()).then(d => setDisputes(d.disputes || []));
  };

  const resolveDispute = async (rental_id, action) => {
    await fetch('/api/admin/no-show-disputes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rental_id, action }),
    });
    load();
  };

  const searchUsers = async () => {
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query)}`);
    const d = await res.json();
    setUsers(d.users || []);
  };

  const toggleSuspend = async (user_id, currentlySuspended) => {
    await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id, action: currentlySuspended ? 'unsuspend' : 'suspend' }),
    });
    searchUsers();
  };

  if (allowed === null) return <p style={{ color: 'var(--ink-faint)' }}>Loading…</p>;
  if (allowed === false) return <p style={{ color: 'var(--oxblood)' }}>Not authorized.</p>;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 22 }}>Admin</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 22 }}>
        {['reports', 'disputes', 'users'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={t === tab ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: 13, textTransform: 'capitalize' }}>
            {t} {t === 'reports' && reports.length ? `(${reports.length})` : ''}{t === 'disputes' && disputes.length ? `(${disputes.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'reports' && (
        <div>
          {reports.length === 0 && <p style={{ color: 'var(--ink-faint)', fontSize: 13.5 }}>No reports.</p>}
          {reports.map(r => (
            <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 13.5 }}><b>{r.reporter?.full_name}</b> reported <b>{r.reported?.full_name}</b></div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>{r.reason}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 6 }}>
                No-shows: {r.reported?.no_show_count || 0} · {r.reported?.suspended ? 'Suspended' : 'Active'} · {new Date(r.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'disputes' && (
        <div>
          {disputes.length === 0 && <p style={{ color: 'var(--ink-faint)', fontSize: 13.5 }}>No disputes awaiting review.</p>}
          {disputes.map(d => (
            <div key={d.id} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 14, marginBottom: 10 }}>
              <div style={{ fontSize: 13.5 }}>{d.listings?.name} — {d.owner?.full_name} / {d.renter?.full_name}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>Dispute reason: {d.no_show_dispute_reason}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => resolveDispute(d.id, 'uphold')}>Uphold strike</button>
                <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => resolveDispute(d.id, 'dismiss')}>Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or username" style={{ flex: 1, padding: 8, border: '1px solid var(--line)', borderRadius: 4 }} onKeyDown={e => e.key === 'Enter' && searchUsers()} />
            <button className="btn btn-ghost" onClick={searchUsers}>Search</button>
          </div>
          {users.map(u => (
            <div key={u.id} style={{ border: '1px solid var(--line)', borderRadius: 4, padding: 14, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{u.full_name} {u.username && `· @${u.username}`}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-faint)' }}>No-shows: {u.no_show_count || 0} · Cancellations: {u.cancellation_count || 0} · {u.suspended ? 'Suspended' : 'Active'}</div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12.5 }} onClick={() => toggleSuspend(u.id, u.suspended)}>
                {u.suspended ? 'Unsuspend' : 'Suspend'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
