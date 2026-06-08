// Minimal forward-only migration runner. Applies every *.sql file in ./migrations
// in lexical order exactly once, tracked in the schema_migrations table.
// Runs on the privileged (owner) connection.
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminPool, closePools } from '../db.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * On managed Postgres (e.g. Railway) you start with a single superuser. When
 * BOOTSTRAP_APP_ROLE=true, create the non-owner RLS runtime role from APP_DATABASE_URL
 * so the privileged owner connection can provision it before migrations grant to it.
 * No-op locally (where roles are created out of band) unless explicitly enabled.
 */
async function ensureAppRole(): Promise<void> {
  if (process.env.BOOTSTRAP_APP_ROLE !== 'true' || !process.env.APP_DATABASE_URL) return;
  const u = new URL(process.env.APP_DATABASE_URL);
  const role = decodeURIComponent(u.username);
  const pw = decodeURIComponent(u.password);
  if (!role || !pw) throw new Error('APP_DATABASE_URL must include a username and password to bootstrap');
  // Role/DB names go into DDL as identifiers (cannot be bound params); validate strictly.
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(role)) throw new Error(`Unsafe role name: ${role}`);
  const ident = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

  const exists = await adminPool.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role]);
  const verb = exists.rowCount ? 'ALTER' : 'CREATE';
  await adminPool.query(`${verb} ROLE ${ident(role)} LOGIN PASSWORD ${literal(pw)}`);
  const db = (await adminPool.query<{ current_database: string }>('SELECT current_database()')).rows[0]!
    .current_database;
  await adminPool.query(`GRANT CONNECT ON DATABASE ${ident(db)} TO ${ident(role)}`);
  console.log(`✓ ensured runtime role "${role}"`);
}

async function run(): Promise<void> {
  await ensureAppRole();
  await adminPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await adminPool.query<{ name: string }>('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    const client = await adminPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`✓ applied ${file}`);
      count++;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`✗ failed ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }
  console.log(count === 0 ? 'Already up to date.' : `Applied ${count} migration(s).`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closePools());
