// Google sign-in, invite and password-reset links land here.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = url.searchParams.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/portal';
  const fail = (msg: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, url.origin));

  // The sign-up hook's refusal ("invite-only", "use your GUC email") comes back here.
  const err = url.searchParams.get('error_description');
  if (err) return fail(err);

  const code = url.searchParams.get('code');
  if (!code) return fail('That sign-in link is incomplete. Try again.');

  const jar = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => jar.set(name, value, options)),
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail('That sign-in link expired. Try again.');
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
