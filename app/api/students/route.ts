import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import database, { type RewardRow, type StudentRow } from "@/lib/db";
import { AcmpProfileError, getAcmpProfile } from "@/lib/acmp";
import { getRecentSolvedCounts } from "@/lib/acmpHistory";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const students = database.prepare("SELECT * FROM students WHERE teacher_id = ? ORDER BY surname, name").all(session.teacherId) as StudentRow[];
  const rewards = database.prepare("SELECT r.* FROM student_rewards r JOIN students s ON s.id = r.student_id WHERE s.teacher_id = ? ORDER BY r.target_solved").all(session.teacherId) as RewardRow[];
  const recent = await Promise.all(students.map(async (student) => {
    try { return await getRecentSolvedCounts(student.acmp_id); } catch { return { solved7: 0, solved14: 0, solved30: 0, solved90: 0, solved180: 0, solved365: 0 }; }
  }));
  return NextResponse.json({ students: students.map((student, index) => ({ ...student, rewards: rewards.filter((reward) => reward.student_id === student.id), ...recent[index] })) });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { acmpId?: string } | null;
  const acmpId = body?.acmpId?.trim();
  if (!acmpId || !/^\d+$/.test(acmpId) || acmpId === "0") return NextResponse.json({ error: "Enter a valid ACMP user ID." }, { status: 400 });
  if (database.prepare("SELECT id FROM students WHERE teacher_id = ? AND acmp_id = ?").get(session.teacherId, acmpId)) return NextResponse.json({ error: "This ACMP ID is already in your student list." }, { status: 409 });
  try {
    const profile = await getAcmpProfile(acmpId);
    const result = database.prepare("INSERT INTO students (teacher_id, name, surname, acmp_id, solved_count, unsolved_count, acmp_name, last_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(session.teacherId, profile.name, "", acmpId, profile.solvedProblems.length, profile.unsolvedProblems.length, profile.name, new Date().toISOString());
    const student = database.prepare("SELECT * FROM students WHERE id = ? AND teacher_id = ?").get(Number(result.lastInsertRowid), session.teacherId) as StudentRow;
    let recent = { solved7: 0, solved14: 0, solved30: 0, solved90: 0, solved180: 0, solved365: 0 }; try { recent = await getRecentSolvedCounts(acmpId); } catch {}
    return NextResponse.json({ student: { ...student, rewards: [], ...recent } }, { status: 201 });
  } catch (error) {
    const message = error instanceof AcmpProfileError ? error.message : "Could not add the student.";
    return NextResponse.json({ error: message }, { status: error instanceof AcmpProfileError && error.code === "NOT_FOUND" ? 404 : 502 });
  }
}
