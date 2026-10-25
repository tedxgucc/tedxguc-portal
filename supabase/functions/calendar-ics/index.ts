// Personal calendar feed (FR-15.9): GET /calendar-ics?token=…
// Members paste this link into Google Calendar or Apple Calendar.
// The token is secret; the member can rotate it from their profile.
import { admin } from '../_shared/clients.ts';
import { corsHeaders, fromDbError, handle, HttpError } from '../_shared/http.ts';
import { buildIcs, type FeedItem } from '../_shared/ics.ts';

Deno.serve(handle(async (req) => {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!/^[0-9a-f]{64}$/.test(token)) throw new HttpError(404, 'not_found');

  const from = new Date(Date.now() - 30 * 86400_000).toISOString();
  const to = new Date(Date.now() + 180 * 86400_000).toISOString();
  const { data, error } = await admin.rpc('calendar_feed_for_token', { p_token: token, p_from: from, p_to: to });
  if (error) throw fromDbError(error);

  return new Response(buildIcs((data ?? []) as FeedItem[], 'TEDxGUC'), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'private, max-age=900',
    },
  });
}));
