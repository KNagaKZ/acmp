import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import database, { type RewardRow } from "@/lib/db";

function ownedStudent(studentId: number, teacherId: number) {
  return database.prepare("SELECT id FROM students WHERE id = ? AND teacher_id = ?").get(studentId, teacherId);
}

function rewardList(studentId: number) {
  return database.prepare("SELECT * FROM student_rewards WHERE student_id = ? ORDER BY target_solved").all(studentId) as RewardRow[];
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const studentId = Number((await context.params).id); if (!ownedStudent(studentId, session.teacherId)) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { targetSolved?: number; giftName?: string; imageData?: string } | null;
  const target = Number(body?.targetSolved); const giftName = body?.giftName?.trim(); const imageData = body?.imageData?.trim() || null;
  if (!Number.isInteger(target) || target < 1 || target > 100000) return NextResponse.json({ error: "Solved target must be a positive whole number." }, { status: 400 });
  if (!giftName || giftName.length > 80) return NextResponse.json({ error: "Enter a gift name up to 80 characters." }, { status: 400 });
  if (imageData && (!/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(imageData) || imageData.length > 2_800_000)) return NextResponse.json({ error: "Use a PNG, JPG, WEBP, or GIF image smaller than 2 MB." }, { status: 400 });
  database.prepare("INSERT INTO student_rewards (student_id, target_solved, gift_name, image_data) VALUES (?, ?, ?, ?)").run(studentId, target, giftName, imageData);
  return NextResponse.json({ rewards: rewardList(studentId) }, { status: 201 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const studentId = Number((await context.params).id); if (!ownedStudent(studentId, session.teacherId)) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { rewardId?: number; delivered?: boolean } | null; const rewardId = Number(body?.rewardId);
  const result = database.prepare("UPDATE student_rewards SET delivered = ? WHERE id = ? AND student_id = ?").run(body?.delivered ? 1 : 0, rewardId, studentId);
  if (!result.changes) return NextResponse.json({ error: "Reward not found." }, { status: 404 });
  return NextResponse.json({ rewards: rewardList(studentId) });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const studentId = Number((await context.params).id); if (!ownedStudent(studentId, session.teacherId)) return NextResponse.json({ error: "Student not found." }, { status: 404 });
  const rewardId = Number(new URL(request.url).searchParams.get("rewardId"));
  database.prepare("DELETE FROM student_rewards WHERE id = ? AND student_id = ?").run(rewardId, studentId);
  return NextResponse.json({ rewards: rewardList(studentId) });
}
