import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import database, { type RewardRow, type StudentRow } from "@/lib/db";
import { getAcmpProfile } from "@/lib/acmp";
import { getRecentSolvedCounts } from "@/lib/acmpHistory";

async function withRewards(student: StudentRow) {
  const rewards = database.prepare("SELECT * FROM student_rewards WHERE student_id = ? ORDER BY target_solved").all(student.id) as RewardRow[];
  let recent = { solved7: 0, solved14: 0, solved30: 0, solved90: 0, solved180: 0, solved365: 0 }; try { recent = await getRecentSolvedCounts(student.acmp_id); } catch {}
  return { ...student, rewards, ...recent };
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const result = database.prepare("DELETE FROM students WHERE id = ? AND teacher_id = ?").run(id, session.teacherId);
  if (!result.changes) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await params;
  const student = database.prepare("SELECT * FROM students WHERE id = ? AND teacher_id = ?").get(id, session.teacherId) as StudentRow | undefined;
  if (!student) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { name?: string; surname?: string } | null;
  if (body && (body.name !== undefined || body.surname !== undefined)) {
    const name = body.name?.trim(); const surname = body.surname?.trim();
    if (!name || !surname) return NextResponse.json({ error: "Name and surname are required." }, { status: 400 });
    database.prepare("UPDATE students SET name = ?, surname = ? WHERE id = ? AND teacher_id = ?").run(name, surname, id, session.teacherId);
    const updated = database.prepare("SELECT * FROM students WHERE id = ? AND teacher_id = ?").get(id, session.teacherId) as StudentRow;
    return NextResponse.json({ student: await withRewards(updated) });
  }
  try {
    const profile = await getAcmpProfile(student.acmp_id);
    database.prepare("UPDATE students SET solved_count = ?, unsolved_count = ?, acmp_name = ?, last_synced = ? WHERE id = ? AND teacher_id = ?").run(profile.solvedProblems.length, profile.unsolvedProblems.length, profile.name, new Date().toISOString(), id, session.teacherId);
    const updated = database.prepare("SELECT * FROM students WHERE id = ? AND teacher_id = ?").get(id, session.teacherId) as StudentRow;
    return NextResponse.json({ student: await withRewards(updated) });
  } catch { return NextResponse.json({ error: "Could not refresh this ACMP profile." }, { status: 502 }); }
}
