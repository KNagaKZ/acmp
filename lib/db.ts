import "server-only";
import postgres from "postgres";
import { createDatabase, type Value } from "./db-core";

let connection: ReturnType<typeof postgres> | undefined;
function client() {
  if (!connection) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is missing. Configure your Supabase Postgres connection in .env.local.");
    connection = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10, ssl: process.env.DATABASE_SSL === "disable" ? false : "require" });
  }
  return connection;
}

const database = {
  ...createDatabase(async (query, values) => {
    const rows = await client().unsafe(query, values);
    return { rows: Array.from(rows), count: rows.count };
  }),
  async transaction<T>(callback: (transaction: ReturnType<typeof createDatabase>) => Promise<T>) {
    // Every statement in the callback uses the SAME connection and rolls back together.
    return client().begin(async (sql) => callback(createDatabase(async (query, values: Value[]) => {
      const rows = await sql.unsafe(query, values);
      return { rows: Array.from(rows), count: rows.count };
    })));
  },
};

export interface TeacherRow { id: number; name: string; surname: string; email: string; password_hash: string; is_super_admin: number; must_change_password: number; one_time_password_hash: string | null; created_at: string }
export interface StudentRow { id: number; teacher_id: number; name: string; surname: string; acmp_id: string; solved_count: number; unsolved_count: number; acmp_name: string | null; last_synced: string | null; created_at: string }
export interface RewardRow { id: number; student_id: number; target_solved: number; gift_name: string; image_data: string | null; delivered: number; created_at: string }
export interface GroupRow { id: number; teacher_id: number; name: string; slug: string; show_gifts: number; created_at: string }
export default database;
