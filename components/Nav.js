'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function Nav() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const logout = async () => {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 28px', borderBottom: '1px solid var(--line)' }}>
      <Link href="/" style={{ fontFamily: 'Fraunces, serif', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', textDecoration: 'none' }}>
        L<span style={{ color: 'var(--oxblood)' }}>oo</span>p
      </Link>
      <nav style={{ display: 'flex', gap: 4 }}>
        <Link href="/" style={{ padding: '9px 16px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>Browse</Link>
        <Link href="/rentals" style={{ padding: '9px 16px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>My rentals</Link>
        <Link href="/favorites" style={{ padding: '9px 16px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>Saved</Link>
        <Link href="/listings/new" style={{ padding: '9px 16px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>List an item</Link>
      </nav>
      <div style={{ position: 'relative' }}>
        {user ? (
          <>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--oxblood-bg)', color: 'var(--oxblood-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, border: 'none' }}
            >
              {(user.email || '?')[0].toUpperCase()}
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 6, minWidth: 160, boxShadow: '0 6px 18px rgba(34,30,25,0.08)', zIndex: 30 }}>
                <Link href="/profile" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '10px 14px', fontSize: 13.5, color: 'var(--ink)', textDecoration: 'none' }}>Profile</Link>
                <button onClick={logout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13.5, color: 'var(--oxblood)', border: 'none', background: 'none' }}>Log out</button>
              </div>
            )}
          </>
        ) : (
          <Link href="/login" style={{ fontSize: 14, color: 'var(--oxblood)', fontWeight: 500, textDecoration: 'none' }}>Log in</Link>
        )}
      </div>
    </header>
  );
}
