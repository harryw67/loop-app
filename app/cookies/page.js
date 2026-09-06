export default function CookiesPage() {
  return (
    <div style={{ maxWidth: 680, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 6, color: 'var(--ink)' }}>Cookies</h1>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 24 }}>Last updated: [DATE]</p>

      <p style={{ marginBottom: 20 }}>
        Loop uses cookies only to keep you signed in — nothing more. We don't use advertising cookies, don't run third-party ad trackers, and don't sell any data collected through cookies, because we don't collect any beyond what's needed to run the Service.
      </p>

      <Section title="Essential cookies (always on)">
        A session cookie, set when you log in, keeps you authenticated as you move around the site. Without it, you'd be logged out every time you loaded a new page. This cookie is required for the Service to function and can't be turned off short of not using Loop.
      </Section>

      <Section title="What we don't use">
        No advertising or retargeting cookies. No third-party analytics trackers. No cross-site tracking of any kind.
      </Section>

      <Section title="Third-party cookies">
        Stripe, our payment processor, may set its own cookies when you're on a payment-related page, governed by <a href="https://stripe.com/cookies-policy/legal" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--oxblood)' }}>Stripe's own cookie policy</a>. We don't control these directly.
      </Section>

      <Section title="Managing cookies">
        You can block or delete cookies through your browser settings, but doing so will log you out of Loop and prevent you from staying signed in.
      </Section>

      <Section title="Changes">
        If this ever changes — for example, if we add analytics in the future — we'll update this page and note the change.
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
