'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier || !password) { setError('Enter your email/username and password.'); return; }
    setSaving(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error); return; }

    // full page reload — the browser's Supabase client only reads the auth
    // cookie once on load, so a soft navigation would leave the nav bar
    // showing "logged out" even though the session is actually valid
    window.location.href = '/';
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 22 }}>Log in to Loop</h1>

      <form onSubmit={submit}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Email or username</label>
          <input value={identifier} onChange={e => setIdentifier(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div style={{ textAlign: 'right', marginBottom: 18 }}>
          <a href="/forgot-password" style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>Forgot password?</a>
        </div>

        {error && <p style={{ color: 'var(--oxblood)', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Logging in…' : 'Log in'}</button>
      </form>

      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 18, textAlign: 'center' }}>
        Don't have an account? <a href="/signup" style={{ color: 'var(--oxblood)' }}>Sign up</a>
      </p>
    </div>
  );
}
