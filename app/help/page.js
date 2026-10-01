const SECTIONS = [
  {
    title: 'Getting started',
    items: [
      { q: 'How do I list something?', a: 'Go to "List an item," add photos, a name, category, size, color, price per day, and a deposit amount. You can also add care instructions and share your location so renters can see how far away you are.' },
      { q: 'How do I rent something?', a: 'Open a listing and either message the owner first or hit "Request to rent" with your dates. The owner has to approve before anything is charged.' },
      { q: 'When does my card get charged?', a: 'The moment the owner approves your request, your card is charged and the money is held — not yet paid to the owner. It only releases to them once you both confirm the handoff in person with the 4-digit code.' },
    ],
  },
  {
    title: 'Handoff & return',
    items: [
      { q: "What's the 4-digit code for?", a: "When you meet up, the owner shows you a code on their screen. Entering it confirms you're both actually there, and it's what triggers your payment to release to them." },
      { q: 'What if something was already damaged?', a: "You get a 1-hour window right after the handoff to photograph anything that doesn't match the listing photos, before you wear it." },
      { q: 'How do I get my deposit back?', a: 'At return, both of you take condition photos and tap "Looks good." Once you both confirm, the deposit releases automatically.' },
      { q: "What if the owner or renter doesn't show up?", a: 'Once the scheduled date arrives, either side can report a no-show, which cancels any payment hold immediately and gets added to that person\'s record.' },
    ],
  },
  {
    title: 'Payments & fees',
    items: [
      { q: "What's Loop's fee?", a: "Loop's standard fee is 15% of the rental price, taken from what the owner receives. If you were referred by someone, your first rental has a reduced fee." },
      { q: 'How do referrals work?', a: 'Every account has a referral code, visible on your profile. Share it — whoever uses it gets 5% off their first rental, and you get a 5% credit toward future rentals.' },
      { q: 'How do I get paid as an owner?', a: 'Connect a payout account from your profile page (via Stripe). Once connected, money from rentals lands there automatically after each handoff.' },
    ],
  },
  {
    title: 'Problems',
    items: [
      { q: 'Something got damaged — what now?', a: 'At return, tap "Raise an issue instead" of confirming. This holds the deposit and flags it for review instead of releasing it automatically.' },
      { q: 'Someone is bothering me', a: "Use the Report or Block button in your conversation with them. Blocking hides their listings from your browse results going forward. See our Safety Center for more." },
      { q: 'I need to cancel a booking', a: 'You can cancel any time before the handoff happens. Cancelling before the owner approves is free; cancelling after approval is tracked on your account if it happens repeatedly.' },
    ],
  },
];

export default function HelpPage() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 22 }}>Help Center</h1>
      {SECTIONS.map(section => (
        <div key={section.title} style={{ marginBottom: 30 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>{section.title}</h2>
          {section.items.map(item => (
            <div key={item.q} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{item.q}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{item.a}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
