import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Used inside API routes / server components — reads the logged-in user's
// session from cookies so RLS policies apply correctly (a user can only
// touch their own rows).
export function supabaseServer() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

// Service-role client — bypasses RLS. Only ever used server-side for admin
// actions like recording a Stripe webhook result. Never expose this key to the browser.
import { createClient } from '@supabase/supabase-js';
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
