import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import database from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 }); const id = Number((await context.params).id);
  if (!database.prepare("SELECT id FROM student_groups WHERE id = ? AND teacher_id = ?").get(id, session.teacherId)) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { name?: string; showGifts?: boolean; studentIds?: number[] } | null;
  if (body?.name !== undefined) { const name = body.name.trim(); if (!name || name.length > 80) return NextResponse.json({ error: "Enter a valid group name." }, { status: 400 }); database.prepare("UPDATE student_groups SET name = ? WHERE id = ?").run(name, id); }
  if (body?.showGifts !== undefined) database.prepare("UPDATE student_groups SET show_gifts = ? WHERE id = ?").run(body.showGifts ? 1 : 0, id);
  if (Array.isArray(body?.studentIds)) { const valid = database.prepare(`SELECT id FROM students WHERE teacher_id = ? AND id IN (${body.studentIds.map(() => "?").join(",") || "NULL"})`).all(session.teacherId, ...body.studentIds) as { id: number }[]; const replace = database.transaction(() => { database.prepare("DELETE FROM group_students WHERE group_id = ?").run(id); const insert = database.prepare("INSERT INTO group_students (group_id, student_id) VALUES (?, ?)"); valid.forEach((student) => insert.run(id, student.id)); }); replace(); }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) { const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 }); const id = Number((await context.params).id); database.prepare("DELETE FROM student_groups WHERE id = ? AND teacher_id = ?").run(id, session.teacherId); return NextResponse.json({ ok: true }); }
