'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function Nav() {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = supabaseBrowser();
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (data.user) {
        const { data: p } = await supabase.from('profiles').select('avatar_url').eq('id', data.user.id).single();
        setAvatarUrl(p?.avatar_url || null);
      }
    });
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
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', gap: 10 }}>
      <Link href="/" style={{ fontFamily: 'Fraunces, serif', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', textDecoration: 'none' }}>
        L<span style={{ color: 'var(--oxblood)' }}>oo</span>p
      </Link>

      <button
        onClick={() => setNavOpen(!navOpen)}
        className="nav-toggle"
        style={{ display: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '6px 10px', fontSize: 13, background: 'var(--white)' }}
      >
        Menu
      </button>

      <nav className="nav-links" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Link href="/" style={{ padding: '9px 14px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>Browse</Link>
        <Link href="/rentals" style={{ padding: '9px 14px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>My rentals</Link>
        <Link href="/favorites" style={{ padding: '9px 14px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>Saved</Link>
        <Link href="/listings/new" style={{ padding: '9px 14px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>List an item</Link>
      </nav>

      <div style={{ position: 'relative' }}>
        {user ? (
          <>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ width: 34, height: 34, borderRadius: '50%', background: avatarUrl ? `url(${avatarUrl}) center/cover` : 'var(--oxblood-bg)', color: 'var(--oxblood-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, border: 'none' }}
            >
              {!avatarUrl && (user.email || '?')[0].toUpperCase()}
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 6, minWidth: 160, boxShadow: '0 6px 18px rgba(34,30,25,0.08)', zIndex: 30 }}>
                <Link href="/profile" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '10px 14px', fontSize: 13.5, color: 'var(--ink)', textDecoration: 'none' }}>Profile</Link>
                <button onClick={logout} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 13.5, color: 'var(--oxblood)', border: 'none', background: 'none' }}>Log out</button>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link href="/login" style={{ fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>Log in</Link>
            <Link href="/signup" style={{ fontSize: 14, color: 'var(--oxblood)', fontWeight: 500, textDecoration: 'none' }}>Sign up</Link>
          </div>
        )}
      </div>

      {navOpen && (
        <nav className="nav-links-mobile" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href="/" style={{ padding: '10px 4px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>Browse</Link>
          <Link href="/rentals" style={{ padding: '10px 4px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>My rentals</Link>
          <Link href="/favorites" style={{ padding: '10px 4px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>Saved</Link>
          <Link href="/listings/new" style={{ padding: '10px 4px', fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>List an item</Link>
        </nav>
      )}
    </header>
  );
}
