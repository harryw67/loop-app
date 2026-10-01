'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabaseClient';
import { compressImage } from '@/lib/imageCompress';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', username: '', password: '', confirmPassword: '',
    college: '', location: '',
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.firstName || !form.lastName || !form.email || !form.username || !form.password) {
      setError('Fill in every required field.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) { setError('Enter a valid email.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError("Passwords don't match."); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(form.username)) { setError('Username: 3-20 characters, letters/numbers/underscore only.'); return; }

    setSaving(true);
    const supabase = supabaseBrowser();

    // check username isn't already taken
    const { data: existingUsername } = await supabase.from('profiles').select('id').eq('username', form.username).maybeSingle();
    if (existingUsername) { setError('That username is already taken.'); setSaving(false); return; }

    // Supabase handles password hashing securely server-side — we never
    // see or store the raw password ourselves.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          first_name: form.firstName,
          last_name: form.lastName,
          username: form.username,
          college: form.college,
          location: form.location,
        },
      },
    });

    if (signUpError) {
      setError(signUpError.message.includes('already registered') ? 'That email is already registered.' : signUpError.message);
      setSaving(false);
      return;
    }

    // if email confirmation is required, there's no session yet
    if (!data.session) {
      setCheckEmail(true);
      setSaving(false);
      return;
    }

    if (avatarFile) {
      const compressed = await compressImage(avatarFile, 500, 0.85);
      const safeName = compressed.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${data.user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, compressed);
      if (!upErr) {
        const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', data.user.id);
      }
    }

    setSaving(false);
    window.location.href = '/';
  };

  if (checkEmail) {
    return (
      <div style={{ maxWidth: 380, margin: '60px auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 10 }}>Check your email</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>We sent a confirmation link to {form.email}. Click it to finish creating your account, then come back and log in.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 6 }}>Create your account</h1>
      <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 22 }}>Use your school email so people know you're a student.</p>

      <form onSubmit={submit}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>First name</label>
            <input value={form.firstName} onChange={e => set('firstName', e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Last name</label>
            <input value={form.lastName} onChange={e => set('lastName', e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@email.sc.edu" />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Username</label>
          <input value={form.username} onChange={e => set('username', e.target.value)} placeholder="letters, numbers, underscore" />
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Password</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Confirm password</label>
            <input type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>College</label>
            <input value={form.college} onChange={e => set('college', e.target.value)} placeholder="University of South Carolina" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Location</label>
            <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Columbia, SC" />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <label>Profile picture (optional)</label>
          <input type="file" accept="image/*" onChange={e => setAvatarFile(e.target.files[0])} />
        </div>

        {error && <p style={{ color: 'var(--oxblood)', fontSize: 12.5, marginBottom: 14 }}>{error}</p>}
        <button className="btn btn-primary btn-block" disabled={saving}>{saving ? 'Creating account…' : 'Sign up'}</button>
      </form>

      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 16, textAlign: 'center' }}>
        Already have an account? <a href="/login" style={{ color: 'var(--oxblood)' }}>Log in</a>
      </p>
    </div>
  );
}
