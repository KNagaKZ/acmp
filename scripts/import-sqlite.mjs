import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import nextEnv from '@next/env';
import postgres from 'postgres';

nextEnv.loadEnvConfig(process.cwd());
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: npm run db:import -- C:/path/to/acmp-visualizer.db (requires Node 22.13+)');
if (!process.env.DATABASE_ADMIN_URL) throw new Error('Set DATABASE_ADMIN_URL for this one-time import.');
const sqlite = new DatabaseSync(resolve(sourcePath), { readOnly: true });
const sql = postgres(process.env.DATABASE_ADMIN_URL, { max: 1, prepare: false, ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require' });
const tables = ['teachers','students','student_rewards','student_groups','group_students','ranklist_entries'];
try {
  await sql.begin(async tx => {
    for (const table of tables) {
      const target = await tx.unsafe(`SELECT count(*)::integer AS count FROM acmp.${table}`);
      if (target[0].count) throw new Error('Import requires an empty database. Existing cloud records were not changed.');
    }
    for (const table of tables) {
      if (!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) continue;
      const sourceRows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      const columns = await tx`SELECT column_name FROM information_schema.columns WHERE table_schema='acmp' AND table_name=${table}`;
      const allowed = new Set(columns.map(column => column.column_name));
      for (const raw of sourceRows) {
        const row = Object.fromEntries(Object.entries(raw).filter(([key]) => allowed.has(key)));
        if (table === 'teachers') row.is_super_admin = 0;
        if (table === 'ranklist_entries') {
          const duplicate = await tx`SELECT id FROM acmp.ranklist_entries WHERE region=${row.region} AND entry_type=${row.entry_type} AND coalesce(student_id,group_id)=${row.student_id ?? row.group_id}`;
          if (duplicate.length) continue;
        }
        const keys = Object.keys(row);
        await tx.unsafe(`INSERT INTO acmp.${table} (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map((_,index) => `$${index + 1}`).join(',')})`, keys.map(key => row[key]));
      }
      if (table !== 'group_students') await tx.unsafe(`SELECT setval(pg_get_serial_sequence('acmp.${table}','id'), coalesce((SELECT max(id) FROM acmp.${table}),1), EXISTS(SELECT 1 FROM acmp.${table}))`);
      console.log(`Imported ${sourceRows.length} ${table} records.`);
    }
  });
  console.log('Import committed. Original SQLite file was opened read-only and preserved.');
} finally { sqlite.close(); await sql.end(); }
