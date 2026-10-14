import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import database from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const id = Number((await context.params).id);
  if (!await database.prepare("SELECT id FROM acmp.student_groups WHERE id = ? AND teacher_id = ?").get(id, session.teacherId)) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { name?: string; showGifts?: boolean; studentIds?: number[] } | null;
  const name = body?.name?.trim();
  if (body?.name !== undefined && (!name || name.length > 80)) return NextResponse.json({ error: "Enter a valid group name." }, { status: 400 });
  await database.transaction(async (transaction) => {
    if (name) await transaction.prepare("UPDATE acmp.student_groups SET name = ? WHERE id = ?").run(name, id);
    if (body?.showGifts !== undefined) await transaction.prepare("UPDATE acmp.student_groups SET show_gifts = ? WHERE id = ?").run(body.showGifts ? 1 : 0, id);
    if (Array.isArray(body?.studentIds)) {
      const valid = await transaction.prepare(`SELECT id FROM acmp.students WHERE teacher_id = ? AND id IN (${body.studentIds.map(() => "?").join(",") || "NULL"})`).all(session.teacherId, ...body.studentIds) as { id: number }[];
      await transaction.prepare("DELETE FROM acmp.group_students WHERE group_id = ?").run(id);
      for (const student of valid) await transaction.prepare("INSERT INTO acmp.group_students (group_id, student_id) VALUES (?, ?)").run(id, student.id);
    }
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  await database.prepare("DELETE FROM acmp.student_groups WHERE id = ? AND teacher_id = ?").run(Number((await context.params).id), session.teacherId);
  return NextResponse.json({ ok: true });
}
