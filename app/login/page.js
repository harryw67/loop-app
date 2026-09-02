'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const sendLink = async () => {
    setError('');
    if (!email.includes('@')) { setError('Enter a valid email.'); return; }
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div style={{ maxWidth: 360, margin: '60px auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 8 }}>Log in to Loop</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 22 }}>
        We'll email you a one-time link — no password needed. Use your school email so people know you're a student.
      </p>
      {sent ? (
        <p style={{ fontSize: 14 }}>Check your inbox for a sign-in link.</p>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>School email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.sc.edu" />
          </div>
          {error && <p style={{ color: 'var(--oxblood)', fontSize: 12.5, marginBottom: 12 }}>{error}</p>}
          <button className="btn btn-primary btn-block" onClick={sendLink}>Send sign-in link</button>
        </>
      )}
    </div>
  );
}
