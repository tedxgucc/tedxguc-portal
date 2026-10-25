import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const url = Deno.env.get('SUPABASE_URL')!;

// Full access. Only for actions the database marks as service-role only.
export const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Acts as the logged-in member, so their role checks and RLS apply.
export function asUser(req: Request) {
  const authorization = req.headers.get('Authorization') ?? '';
  return createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
