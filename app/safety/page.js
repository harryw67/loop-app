export default function SafetyPage() {
  const items = [
    { title: 'Meet in public', body: "Pick a well-lit, public spot for handoffs and returns — a campus library, student union, or coffee shop. Loop can suggest a spot roughly halfway between you two, right in your rental thread." },
    { title: "Payment only happens through Loop", body: "Never pay someone directly, in cash or otherwise, to avoid Loop's fee. If a transaction moves off-platform, none of Loop's protections apply — no deposit holds, no dispute support, no payment safeguards." },
    { title: 'Take the condition photos seriously', body: "The handoff and return photos are what protect both of you if something's disputed later. Don't skip them, and make sure they clearly show the item's actual condition." },
    { title: 'Check the other person before you commit', body: "Before approving or booking, look at the other person's star rating, review count, and any no-show history — all visible right on their profile or listing." },
    { title: 'Trust your instincts', body: "If a meetup feels off, you can cancel before the handoff happens. If someone is behaving inappropriately, use Report or Block immediately." },
    { title: "If something happens during a meetup", body: 'Your physical safety comes first. Leave the situation and contact campus security or local emergency services if needed — deal with the rental itself afterward.' },
  ];

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 10 }}>Safety Center</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 26 }}>
        Loop connects you with other students, but every handoff happens in person, on your own. Here's how to keep that simple and safe.
      </p>
      {items.map(item => (
        <div key={item.title} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 4 }}>{item.title}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.6 }}>{item.body}</div>
        </div>
      ))}
      <div style={{ marginTop: 30, padding: 16, background: 'var(--oxblood-bg)', borderRadius: 6 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--oxblood-ink)', marginBottom: 4 }}>In an emergency</div>
        <div style={{ fontSize: 13, color: 'var(--oxblood-ink)' }}>Call 911 or your campus emergency line first. Report what happened on Loop afterward — Report and Block are in every conversation thread.</div>
      </div>
    </div>
  );
}
