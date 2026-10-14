import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import database, { type TeacherRow } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase(); const password = body?.password ?? "";
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  if (email === "admin" && password === "Admin") {
    await createSession({ teacherId: 0, name: "Super", surname: "Admin", email: "admin", isSuperAdmin: true, mustChangePassword: false });
    return NextResponse.json({ ok: true, mustChangePassword: false, isSuperAdmin: true });
  }
  const teacher = await database.prepare("SELECT * FROM acmp.teachers WHERE email = ?").get(email) as TeacherRow | undefined;
  if (!teacher) return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  const regularPassword = await compare(password, teacher.password_hash); const oneTimePassword = teacher.one_time_password_hash ? await compare(password, teacher.one_time_password_hash) : false;
  if (!regularPassword && !oneTimePassword) return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  if (oneTimePassword) {
    const consumed = await database.prepare("UPDATE acmp.teachers SET one_time_password_hash = NULL, must_change_password = 1 WHERE id = ? AND one_time_password_hash = ?").run(teacher.id, teacher.one_time_password_hash);
    if (!consumed.changes) return NextResponse.json({ error: "This one-time password has already been used." }, { status: 401 });
  }
  const mustChangePassword = oneTimePassword || Boolean(teacher.must_change_password);
  await createSession({ teacherId: teacher.id, name: teacher.name, surname: teacher.surname, email: teacher.email, isSuperAdmin: false, mustChangePassword });
  return NextResponse.json({ ok: true, mustChangePassword, isSuperAdmin: false });
}
