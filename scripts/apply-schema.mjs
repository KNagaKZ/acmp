import { readFile, readdir } from 'node:fs/promises';
import nextEnv from '@next/env';
import postgres from 'postgres';

nextEnv.loadEnvConfig(process.cwd());
if (!process.env.DATABASE_ADMIN_URL) throw new Error('Set DATABASE_ADMIN_URL to the Supabase admin connection before applying migrations.');
const sql = postgres(process.env.DATABASE_ADMIN_URL, { max: 1, prepare: false, ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require' });
try {
  await sql`CREATE SCHEMA IF NOT EXISTS acmp`;
  await sql`CREATE TABLE IF NOT EXISTS acmp.schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
  for (const name of (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) {
    const exists = await sql`SELECT name FROM acmp.schema_migrations WHERE name = ${name}`;
    if (exists.length) continue;
    // An installation initialized through the connector already contains the initial schema.
    const table = await sql`SELECT to_regclass('acmp.teachers') AS name`;
    if (table[0].name && name.endsWith('_acmp_schema.sql')) {
      await sql`INSERT INTO acmp.schema_migrations (name) VALUES (${name})`;
      continue;
    }
    const source = await readFile(`supabase/migrations/${name}`, 'utf8');
    await sql.begin(async tx => {
      await tx.unsafe(source);
      await tx`INSERT INTO acmp.schema_migrations (name) VALUES (${name})`;
    });
    console.log(`Applied ${name}`);
  }
  console.log('Database schema is ready.');
} finally { await sql.end(); }
