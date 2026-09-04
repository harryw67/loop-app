'use client';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabaseClient';

export default function TermsModal({ onAgree, onCancel }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const agree = async () => {
    setSaving(true);
    const supabase = supabaseBrowser();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('profiles').update({ agreed_terms_at: new Date().toISOString() }).eq('id', user.id);
    setSaving(false);
    onAgree();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(34,30,25,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}>
      <div style={{ background: 'var(--white)', borderRadius: 6, maxWidth: 460, width: '100%', padding: 28, maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 500, marginBottom: 14 }}>Before you continue</h2>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
          <p style={{ marginBottom: 10 }}>By renting or listing on Loop, you agree to:</p>
          <ul style={{ paddingLeft: 18, marginBottom: 10 }}>
            <li><b>Wash or dry-clean any item before returning it.</b> Items should come back in the same clean condition they were handed over in — normal wear is fine, but returning something unwashed counts as a condition mismatch.</li>
            <li>Return items by the date agreed with the owner. Late returns may be treated as a dispute.</li>
            <li>Cover the cost of any damage beyond normal wear, up to the item's stated deposit amount.</li>
            <li>Take honest, unedited condition photos at both handoff and return — this is what protects you too if something's disputed.</li>
            <li>Meet in a public, well-lit place for handoffs when possible.</li>
          </ul>
          <p style={{ marginBottom: 10 }}>
            Loop facilitates the connection, payment, and condition record between renter and owner, but isn't a party to what you agree to rent, and isn't liable for loss, damage, injury, or disputes arising from a rental. Renters and owners are responsible for resolving issues between themselves, using the photo record as evidence; Loop's dispute flow is a tool for that, not a guarantee of any outcome.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, marginTop: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2 }} />
          I've read this and agree.
        </label>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={agree} disabled={!checked || saving}>
            {saving ? 'Saving…' : 'Agree & continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
