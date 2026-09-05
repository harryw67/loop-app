export default function TermsPage() {
  return (
    <div style={{ maxWidth: 680, fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 6, color: 'var(--ink)' }}>Terms of Service</h1>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 24 }}>Last updated: [DATE]</p>

      <div style={{ padding: 14, background: 'var(--mustard-bg)', borderRadius: 6, marginBottom: 26, fontSize: 12.5, color: 'var(--mustard-ink)' }}>
        This is a draft prepared without review by a licensed attorney. It's here so the terms governing Loop are transparent while the business finalizes its official legal documents.
      </div>

      <Section title="1. Acceptance of These Terms">
        By creating an account, browsing listings, listing an item, or completing a rental on Loop, you agree to be bound by these Terms and our Privacy Policy. If you do not agree, do not use the Service.
      </Section>

      <Section title="2. Eligibility">
        You must be at least 18 years old and capable of forming a binding contract to use Loop.
      </Section>

      <Section title="3. What Loop Is">
        Loop is a peer-to-peer marketplace connecting people who want to rent out clothing ("Owners") with people who want to rent it ("Renters"). Loop is not a party to the rental agreement between an Owner and a Renter — we provide the technology, not the item, the insurance, or a guarantee of either party's behavior.
      </Section>

      <Section title="4. Accounts">
        You're responsible for your account's security and for all activity under it. One account per person. We may suspend or terminate accounts that violate these Terms.
      </Section>

      <Section title="5. Listings">
        Owners represent that they own or have the right to rent out any listed item, and that photos/descriptions are accurate. Owners set their own price, deposit, and rental duration limits, and are solely responsible for setting a deposit adequate to cover potential damage — Loop does not insure or guarantee items beyond the deposit collected.
      </Section>

      <Section title="6. Booking, Approval & Cancellation">
        A booking isn't confirmed until the Owner approves it. Unanswered requests expire after 36 hours. Cancelling before approval is free; cancelling after approval but before handoff is tracked against your account if repeated. Neither party may cancel after handoff is confirmed.
      </Section>

      <Section title="7. Payments, Fees & Deposits">
        When an Owner approves a booking, the Renter's card is charged and the funds are held — not yet paid to the Owner — until both parties confirm the in-person handoff. Loop's standard fee is 15% of the rental price; referred users may pay a reduced fee on their first rental. Deposits are held separately and released automatically once a return is confirmed in good condition. All payments are processed by Stripe, Inc.
      </Section>

      <Section title="8. Condition Documentation">
        Owners' listing photos serve as the baseline condition record. Renters have a limited window after handoff to document pre-existing issues. Both parties are expected to document condition at return.
      </Section>

      <Section title="9. Disputes Between Users">
        Loop is not a party to, and does not formally adjudicate, condition or damage disputes between Owner and Renter. Where Loop staff review a dispute (e.g., a contested no-show report), any decision is at Loop's discretion and solely affects the platform record — it is not a legal determination of fault.
      </Section>

      <Section title="10. No-Shows">
        Either party may report a no-show once the scheduled date arrives if the handoff never happened; this cancels any payment hold and is recorded against the non-appearing party. Reports may be disputed within 48 hours.
      </Section>

      <Section title="11. Reviews">
        Users may rate and review each other after a rental concludes, including after a dispute or no-show. Fake, retaliatory, or manipulated reviews are prohibited.
      </Section>

      <Section title="12. Referral Program">
        Referral credit has no cash value and can only be applied toward future rentals. Loop may adjust, cap, expire, or revoke referral credit obtained through fraud or abuse.
      </Section>

      <Section title="13. Prohibited Conduct">
        You may not: use the Service for illegal goods or services of any kind; list items you don't own or control; provide false information; harass or endanger other users; conduct transactions off-platform to avoid fees; circumvent the Service's security or payment mechanics; impersonate another person; upload unlawful or infringing content; or violate any applicable law. Loop uses automated screening in addition to user reports to flag potential violations.
      </Section>

      <Section title="13a. Cooperation with Law Enforcement">
        Loop may disclose relevant account and transaction information to law enforcement or other authorities in response to a valid legal request, or where we reasonably believe activity on the Service is illegal.
      </Section>

      <Section title="14. In-Person Meetups — Assumption of Risk">
        You are solely responsible for your own safety when meeting another user. Loop does not supervise in-person handoffs and is not liable for harm arising from them.
      </Section>

      <Section title="15–16. Content License & Intellectual Property">
        By posting content, you grant Loop a license to host and display it in connection with operating the Service. Loop's name, logo, and platform remain Loop's property.
      </Section>

      <Section title="17–19. Disclaimers, Limitation of Liability & Indemnification">
        The Service is provided "as is." Loop's liability for any claim is limited as described in the full Terms document, and you agree to indemnify Loop against claims arising from your use of the Service, your listings, or your interactions with other users.
      </Section>

      <Section title="20–25. Dispute Resolution, Governing Law & General Terms">
        These Terms are governed by the laws of [STATE]. They may be updated from time to time, with notice provided for material changes. Questions can be sent to [CONTACT EMAIL].
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
