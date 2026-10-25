// Daily housekeeping, run by Supabase Cron with the service role key:
//   - deletes applicant data 6 months after a cycle closes, CV files too (FR-4.8)
//   - expires unpaid package orders (backup for the pg_cron job, FR-16.6)
// Rejects any caller that isn't using the service role key.
import { admin } from '../_shared/clients.ts';
import { fromDbError, handle, HttpError, json } from '../_shared/http.ts';

Deno.serve(handle(async (req) => {
  const key = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!key || key !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) throw new HttpError(401, 'unauthorized');

  const { data: paths, error } = await admin.rpc('purge_old_applications');
  if (error) throw fromDbError(error);
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { error: rmErr } = await admin.storage.from('applications').remove(batch);
    if (rmErr) console.error('CV delete failed', rmErr);
    else removed += batch.length;
  }

  const { data: expired, error: expErr } = await admin.rpc('expire_orders');
  if (expErr) throw fromDbError(expErr);

  return json({ applications_purged: paths.length, cv_files_removed: removed, orders_expired: expired });
}));
