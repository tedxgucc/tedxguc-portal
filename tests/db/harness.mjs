// Test harness: boots an in-memory Postgres, applies the Supabase shim,
// every migration in order and the seed, then lets tests run SQL as a
// given user (anon, a logged-in member, or the service role).
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(root, 'supabase', 'migrations');

export async function createDb(migrationLimit) {
  const db = new PGlite();
  await db.exec(readFileSync(join(root, 'tests', 'db', 'supabase-shim.sql'), 'utf8'));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql') && (!migrationLimit || f <= migrationLimit)).sort()) {
    try {
      await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
    } catch (err) {
      err.message = `${file}: ${err.message}`;
      throw err;
    }
  }
  await db.exec(readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8'));
  return wrap(db);
}

function wrap(db) {
  // Run fn inside a transaction as `who`: 'anon', 'service', or a user id.
  async function as(who, fn) {
    return db.transaction(async (tx) => {
      if (who === 'service') {
        await tx.query(`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`);
        await tx.exec('set local role service_role');
      } else if (who === 'anon' || who == null) {
        await tx.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`);
        await tx.exec('set local role anon');
      } else {
        const claims = JSON.stringify({ sub: who, role: 'authenticated' });
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
        await tx.exec('set local role authenticated');
      }
      const q = async (sql, params = []) => (await tx.query(sql, params)).rows;
      const one = async (sql, params = []) => (await q(sql, params))[0];
      return fn({ q, one, tx });
    });
  }

  // Superuser helpers for setting up test data.
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const one = async (sql, params = []) => (await q(sql, params))[0];

  const ids = {};
  async function team(kind) {
    if (!ids[kind]) {
      ids[kind] = (await one(
        `select t.id from public.teams t join public.seasons s on s.id = t.season_id and s.is_active where t.kind = $1`,
        [kind])).id;
    }
    return ids[kind];
  }
  async function division(kind) {
    return (await one(
      `select d.id from public.divisions d join public.seasons s on s.id = d.season_id and s.is_active where d.kind = $1`,
      [kind])).id;
  }

  // Create an invited member and sign them up, like a first login.
  let counter = 0;
  async function member(role, where = null, { name } = {}) {
    counter += 1;
    const email = `member${counter}@student.guc.edu.eg`;
    const season = (await one(`select id from public.seasons where is_active`)).id;
    let teamId = null;
    let divisionId = null;
    if (role === 'curator') divisionId = await division(where);
    if (role === 'executive' || role === 'associate') teamId = await team(where);
    await q(
      `insert into public.invites (email, season_id, role, division_id, team_id) values ($1, $2, $3, $4, $5)`,
      [email, season, role, divisionId, teamId]);
    const user = await one(
      `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
      [email, { full_name: name ?? `${role} ${counter}` }]);
    return user.id;
  }

  return { as, q, one, team, division, member, raw: db };
}

// Assert that a promise rejects with a message matching `pattern`.
export async function rejects(promise, pattern) {
  try {
    await promise;
  } catch (err) {
    if (pattern && !pattern.test(err.message)) {
      throw new Error(`Expected error matching ${pattern}, got: ${err.message}`);
    }
    return err;
  }
  throw new Error(`Expected an error matching ${pattern}, but it succeeded`);
}
