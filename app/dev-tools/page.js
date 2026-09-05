'use client';
import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

// Two fixed test accounts — only meant for you to test both sides of a
// rental quickly. This page only works when you're running locally
// (localhost), so it's harmless even though it ships in the code.
const SELLER = { email: 'seller@loop.test', password: 'TestPass123!', firstName: 'Sara', lastName: 'Seller', username: 'testseller' };
const BUYER = { email: 'buyer@loop.test', password: 'TestPass123!', firstName: 'Bob', lastName: 'Buyer', username: 'testbuyer' };

export default function DevToolsPage() {
  const [isLocal, setIsLocal] = useState(false);
  const [status, setStatus] = useState('');
  const [whoAmI, setWhoAmI] = useState(null);

  useEffect(() => {
    setIsLocal(['localhost', '127.0.0.1'].includes(window.location.hostname));
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => setWhoAmI(data.user?.email || null));
  }, []);

  const createAccount = async (acct) => {
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signUp({
      email: acct.email,
      password: acct.password,
      options: { data: { first_name: acct.firstName, last_name: acct.lastName, username: acct.username } },
    });
    if (error && !error.message.includes('already registered')) throw error;
  };

  const setUpBoth = async () => {
    setStatus('Creating both test accounts…');
    try {
      await createAccount(SELLER);
      await createAccount(BUYER);
      setStatus('Both accounts ready. Log in as either one below.\n(If email confirmation is on in Supabase, turn it off for these to work immediately — Authentication > Providers > Email.)');
    } catch (e) {
      setStatus('Error: ' + e.message);
    }
  };

  const loginAs = async (acct) => {
    setStatus(`Logging in as ${acct.email}…`);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: acct.email, password: acct.password }),
    });
    const data = await res.json();
    if (!res.ok) { setStatus('Login failed: ' + data.error); return; }
    window.location.href = '/';
  };

  if (!isLocal) {
    return <p style={{ color: 'var(--ink-faint)' }}>Dev tools are only available when running locally.</p>;
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 6 }}>Dev tools</h1>
      <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginBottom: 20 }}>
        Currently logged in as: {whoAmI || 'nobody'}
      </p>

      <button className="btn btn-ghost btn-block" onClick={setUpBoth} style={{ marginBottom: 18 }}>
        Create both test accounts (safe to click again)
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => loginAs(SELLER)}>Log in as Seller ({SELLER.email})</button>
        <button className="btn btn-primary" onClick={() => loginAs(BUYER)}>Log in as Buyer ({BUYER.email})</button>
      </div>

      {status && <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 16, whiteSpace: 'pre-wrap' }}>{status}</p>}

      <p style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 24 }}>
        Tip: log in as Seller in a normal window and Buyer in an incognito window (or vice versa) so you can have both open side by side and watch a rental update live on both sides.
      </p>
    </div>
  );
}
