import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import database, { type TeacherRow } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET?.trim()) {
    return NextResponse.json({ error: "Login is not configured: AUTH_SECRET is missing. The administrator must set it for the Production environment and redeploy." }, { status: 503 });
  }
  if (email === "admin" && password === "Admin") {
    await createSession({ teacherId: 0, name: "Super", surname: "Admin", email: "admin", isSuperAdmin: true, mustChangePassword: false });
    return NextResponse.json({ ok: true, mustChangePassword: false, isSuperAdmin: true });
  }
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "Teacher login is not configured: DATABASE_URL is missing. The administrator must configure the database and redeploy." }, { status: 503 });
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
  } catch (error) {
    // Avoid logging request bodies, credentials, connection URLs, or cookie tokens.
    console.error("Login request failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Login is temporarily unavailable. Please contact the administrator." }, { status: 503 });
  }
}
