import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req) {
  const { identifier, password } = await req.json();
  if (!identifier || !password) return NextResponse.json({ error: 'Enter your email/username and password' }, { status: 400 });

  let email = identifier.trim();

  // if they typed a username instead of an email, resolve it to an email
  // server-side using the service-role key — this never touches the
  // client, so no one's email address is ever exposed to anyone else.
  if (!email.includes('@')) {
    const admin = supabaseAdmin();
    const { data: profile } = await admin.from('profiles').select('id').eq('username', email).maybeSingle();
    if (!profile) return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });

    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(profile.id);
    if (userErr || !userData?.user?.email) return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });
    email = userData.user.email;
  }

  // this uses the cookie-bound server client, so a successful sign-in sets
  // the real session cookies on the response — same as normal email login
  const supabase = supabaseServer();
  const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('suspended').eq('id', signInData.user.id).single();
  if (profile?.suspended) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: 'This account has been suspended.' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
