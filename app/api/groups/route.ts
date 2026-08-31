import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import database, { type GroupRow } from "@/lib/db";

function groupPayload(teacherId: number) {
  const groups = database.prepare("SELECT * FROM student_groups WHERE teacher_id = ? ORDER BY name").all(teacherId) as GroupRow[];
  const members = database.prepare("SELECT gs.group_id, gs.student_id FROM group_students gs JOIN student_groups g ON g.id = gs.group_id WHERE g.teacher_id = ?").all(teacherId) as { group_id: number; student_id: number }[];
  return groups.map((group) => ({ ...group, studentIds: members.filter((item) => item.group_id === group.id).map((item) => item.student_id) }));
}

export async function GET() { const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 }); return NextResponse.json({ groups: groupPayload(session.teacherId) }); }

export async function POST(request: Request) {
  const session = await getSession(); if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: string } | null; const name = body?.name?.trim();
  if (!name || name.length > 80) return NextResponse.json({ error: "Enter a group name up to 80 characters." }, { status: 400 });
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 35) || "group"}-${randomBytes(4).toString("hex")}`;
  database.prepare("INSERT INTO student_groups (teacher_id, name, slug) VALUES (?, ?, ?)").run(session.teacherId, name, slug);
  return NextResponse.json({ groups: groupPayload(session.teacherId) }, { status: 201 });
}
