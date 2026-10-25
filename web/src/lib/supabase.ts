// Supabase clients. In the browser the client carries the member's session
// (cookies), so every query runs under row-level security as them. On the
// server, public pages use the anon key with no session: guests' view.
import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env';

let browserClient: SupabaseClient | null = null;
let serverAnonClient: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (typeof window !== 'undefined') {
    browserClient ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return browserClient;
  }
  serverAnonClient ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serverAnonClient;
}
