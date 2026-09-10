'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }

    setSaving(true);
    const supabase = supabaseBrowser();
    // Supabase reads the recovery token from the URL automatically and
    // uses it to authorize this password change — no custom token
    // handling needed on our end.
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => router.push('/login'), 1500);
  };

  if (done) {
    return (
      <div style={{ maxWidth: 360, margin: '60px auto', textAlign: 'center' }}>
        <p style={{ fontSize: 14, color: 'var(--sage-ink)' }}>Password updated — taking you to log in…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 360, margin: '60px auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 18 }}>Set a new password</h1>
      <form onSubmit={submit}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>New password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Confirm new password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
        </div>
        {error && <p style={{ color: 'var(--oxblood)', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Saving…' : 'Set new password'}</button>
      </form>
    </div>
  );
}
