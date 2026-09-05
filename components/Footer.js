import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 60, padding: '28px 20px 40px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '24px 40px', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, marginBottom: 10 }}>
            L<span style={{ color: 'var(--oxblood)' }}>oo</span>p
          </div>
          <a href="https://instagram.com/loopclothingrental" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--ink-faint)', textDecoration: 'none' }}>
            @loopclothingrental
          </a>
        </div>

        <div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Support</div>
          <FooterLink href="/help">Help Center</FooterLink>
          <FooterLink href="/safety">Safety Center</FooterLink>
          <FooterLink href="/status">Loop Status</FooterLink>
        </div>

        <div>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Legal</div>
          <FooterLink href="/terms">Terms & Conditions</FooterLink>
          <FooterLink href="/privacy">Privacy Policy</FooterLink>
          <FooterLink href="/cookies">Cookies</FooterLink>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <Link href={href} style={{ fontSize: 12.5, color: 'var(--ink-soft)', textDecoration: 'none' }}>{children}</Link>
    </div>
  );
}
