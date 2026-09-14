'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) return;
    setSaving(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSaving(false);
    // always show success, even if the email doesn't exist — avoids
    // leaking which emails are registered
    setSent(true);
    if (error) console.error(error);
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 10 }}>Reset your password</h1>
      {sent ? (
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>If an account exists for {email}, we've sent a reset link — check your inbox.</p>
      ) : (
        <form onSubmit={submit}>
          <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 18 }}>Enter your email and we'll send you a link to set a new password.</p>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {error && <p style={{ color: 'var(--oxblood)', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}
          <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Sending…' : 'Send reset link'}</button>
        </form>
      )}
    </div>
  );
}
