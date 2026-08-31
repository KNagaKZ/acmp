import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import database, { type TeacherRow } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { name?: string; surname?: string; email?: string; password?: string } | null;
  const name = body?.name?.trim(); const surname = body?.surname?.trim(); const email = body?.email?.trim().toLowerCase(); const password = body?.password ?? "";
  if (!name || !surname || !email || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return NextResponse.json({ error: "Enter your name, surname, valid email, and a password of at least 8 characters." }, { status: 400 });
  if (database.prepare("SELECT id FROM teachers WHERE email = ?").get(email)) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  try {
    const passwordHash = await hash(password, 12);
    const result = database.prepare("INSERT INTO teachers (name, surname, email, password_hash, is_super_admin) VALUES (?, ?, ?, ?, 0)").run(name, surname, email, passwordHash);
    const teacher = database.prepare("SELECT * FROM teachers WHERE id = ?").get(Number(result.lastInsertRowid)) as TeacherRow;
    await createSession({ teacherId: teacher.id, name: teacher.name, surname: teacher.surname, email: teacher.email, isSuperAdmin: false, mustChangePassword: false });
    return NextResponse.json({ ok: true, isSuperAdmin: false });
  } catch { return NextResponse.json({ error: "Could not create the account." }, { status: 500 }); }
}
