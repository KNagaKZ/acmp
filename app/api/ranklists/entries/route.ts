import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import database from "@/lib/db";

const regions = ["south", "north", "east", "west"];
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const where = session.isSuperAdmin ? "" : "WHERE teacher_id = ?";
  const args = session.isSuperAdmin ? [] : [session.teacherId];
  const [students, groups, entries] = await Promise.all([
    database.prepare(`SELECT id,name,surname,acmp_id,teacher_id FROM acmp.students ${where} ORDER BY name`).all(...args),
    database.prepare(`SELECT id,name,teacher_id FROM acmp.student_groups ${where} ORDER BY name`).all(...args),
    database.prepare(`SELECT * FROM acmp.ranklist_entries ${where} ORDER BY region`).all(...args),
  ]);
  return NextResponse.json({ students, groups, entries, isSuperAdmin: session.isSuperAdmin });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { region?: string; entryType?: string; entryId?: number } | null;
  const region = body?.region ?? ""; const entryType = body?.entryType ?? "";
  if (!regions.includes(region) || !["student", "group"].includes(entryType)) return NextResponse.json({ error: "Invalid ranklist entry." }, { status: 400 });
  const table = entryType === "student" ? "students" : "student_groups";
  const item = await database.prepare(`SELECT id,teacher_id FROM acmp.${table} WHERE id = ?`).get(Number(body?.entryId)) as { id: number; teacher_id: number } | undefined;
  if (!item || (!session.isSuperAdmin && item.teacher_id !== session.teacherId)) return NextResponse.json({ error: "You can add only your own students or groups." }, { status: 403 });
  const field = entryType === "student" ? "student_id" : "group_id";
  // Unique indexes plus ON CONFLICT make repeated/concurrent submissions idempotent.
  await database.prepare(`INSERT INTO acmp.ranklist_entries (teacher_id,region,entry_type,${field}) VALUES (?,?,?,?) ON CONFLICT DO NOTHING`).run(item.teacher_id, region, entryType, item.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  const entry = await database.prepare("SELECT teacher_id FROM acmp.ranklist_entries WHERE id = ?").get(id) as { teacher_id: number } | undefined;
  if (!entry || (!session.isSuperAdmin && entry.teacher_id !== session.teacherId)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  await database.prepare("DELETE FROM acmp.ranklist_entries WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
