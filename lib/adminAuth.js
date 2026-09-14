import { supabaseServer } from '@/lib/supabaseServer';

// Verifies the requesting user is an admin using the normal cookie-bound
// client (respects RLS for this check). Returns the user if they're an
// admin, or null. Callers should then use supabaseAdmin() for the actual
// cross-user reads/writes, since regular RLS would block those.
export async function requireAdmin() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return null;
  return user;
}
