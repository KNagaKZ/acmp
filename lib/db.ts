import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDirectory = path.join(process.cwd(), "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new Database(path.join(dataDirectory, "acmp-visualizer.db"));
database.pragma("journal_mode = WAL");
database.pragma("foreign_keys = ON");
database.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    surname TEXT NOT NULL,
    acmp_id TEXT NOT NULL,
    solved_count INTEGER NOT NULL DEFAULT 0,
    unsolved_count INTEGER NOT NULL DEFAULT 0,
    acmp_name TEXT,
    last_synced TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    UNIQUE (teacher_id, acmp_id)
  );
  CREATE TABLE IF NOT EXISTS student_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    target_solved INTEGER NOT NULL,
    gift_name TEXT NOT NULL,
    image_data TEXT,
    delivered INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS student_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    show_gifts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS group_students (
    group_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    PRIMARY KEY (group_id, student_id),
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS ranklist_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    region TEXT NOT NULL CHECK(region IN ('south','north','east','west')),
    entry_type TEXT NOT NULL CHECK(entry_type IN ('student','group')),
    student_id INTEGER,
    group_id INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES student_groups(id) ON DELETE CASCADE
  );
`);

const teacherColumns = database.pragma("table_info(teachers)") as { name: string }[];
if (!teacherColumns.some((column) => column.name === "is_super_admin")) database.exec("ALTER TABLE teachers ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0");
if (!teacherColumns.some((column) => column.name === "must_change_password")) database.exec("ALTER TABLE teachers ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
if (!teacherColumns.some((column) => column.name === "one_time_password_hash")) database.exec("ALTER TABLE teachers ADD COLUMN one_time_password_hash TEXT");
database.prepare("UPDATE teachers SET is_super_admin = 0 WHERE is_super_admin != 0").run();

export interface TeacherRow { id: number; name: string; surname: string; email: string; password_hash: string; is_super_admin: number; must_change_password: number; one_time_password_hash: string | null; created_at: string }
export interface StudentRow { id: number; teacher_id: number; name: string; surname: string; acmp_id: string; solved_count: number; unsolved_count: number; acmp_name: string | null; last_synced: string | null; created_at: string }
export interface RewardRow { id: number; student_id: number; target_solved: number; gift_name: string; image_data: string | null; delivered: number; created_at: string }
export interface GroupRow { id: number; teacher_id: number; name: string; slug: string; show_gifts: number; created_at: string }

export default database;
