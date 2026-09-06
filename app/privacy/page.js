export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 680, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 6, color: 'var(--ink)' }}>Privacy Policy</h1>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 24 }}>Last updated: [DATE]</p>

      <div style={{ padding: 14, background: 'var(--mustard-bg)', borderRadius: 6, marginBottom: 26, fontSize: 12.5, color: 'var(--mustard-ink)' }}>
        This is a draft prepared without review by a licensed attorney or privacy specialist.
      </div>

      <Section title="What we collect">
        Directly from you: name, email, username, college, location text, bio, profile photo, listing photos and details, condition photos, and messages sent through the Service. We do not collect your precise home address — when you share your location for distance features, we store an approximate point (randomly offset by roughly 100-300 feet) rather than your exact coordinates.
      </Section>

      <Section title="Payment information">
        Loop does not store your full card number. Payments are processed by Stripe, and we retain only what's needed to operate the Service — such as a card "fingerprint" (a non-reversible identifier Stripe provides, used only to detect potential referral-program abuse) and your Stripe customer/account IDs.
      </Section>

      <Section title="Account activity we track">
        We keep records of your rentals, reviews, reports, no-shows, and cancellations, since these are core to how the platform works (for example, showing another user your reliability record before they approve a booking with you).
      </Section>

      <Section title="How we use your information">
        To operate the Service: matching renters and owners, processing payments, showing distance and availability, sending you account-related communications (password resets, booking updates), and reviewing reports or disputes. We do not sell your personal information.
      </Section>

      <Section title="Who we share it with">
        <b style={{ color: 'var(--ink)' }}>Other users</b> see your name, profile photo, bio, star rating, and review/no-show history when relevant to a transaction. <b style={{ color: 'var(--ink)' }}>Stripe</b> processes payments and handles identity verification for payouts. <b style={{ color: 'var(--ink)' }}>Supabase</b> hosts our database, authentication, and file storage. We may disclose information to law enforcement in response to a valid legal request, as described in our Terms of Service.
      </Section>

      <Section title="Your choices">
        You can edit most of your profile information at any time. You can request account deletion by contacting us at [CONTACT EMAIL]. Some records (such as transaction history) may be retained as required for legal, tax, or fraud-prevention purposes even after account deletion.
      </Section>

      <Section title="Children's privacy">
        Loop is not directed at, and does not knowingly collect information from, anyone under 18.
      </Section>

      <Section title="Changes to this policy">
        We may update this policy from time to time. Material changes will be communicated through the Service.
      </Section>

      <Section title="Contact">
        Questions about this policy can be sent to [CONTACT EMAIL].
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
