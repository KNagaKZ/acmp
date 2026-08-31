import { NextResponse } from "next/server";
import database, { type GroupRow, type RewardRow, type StudentRow } from "@/lib/db";
import { getAcmpProfile } from "@/lib/acmp";
import { getRecentSolvedCounts } from "@/lib/acmpHistory";

type StandingPayload = { group: { name: string; slug: string; showGifts: boolean }; students: Array<StudentRow & { solved7: number; solved14: number; solved30: number; solved90: number; solved180: number; solved365: number; gifts: RewardRow[] }>; updatedAt: string };
const cache = new Map<string, { expires: number; payload: StandingPayload }>();

async function buildStandings(slug: string) {
  const group = database.prepare("SELECT * FROM student_groups WHERE slug = ?").get(slug) as GroupRow | undefined; if (!group) return null;
  const students = database.prepare("SELECT s.* FROM students s JOIN group_students gs ON gs.student_id = s.id WHERE gs.group_id = ? ORDER BY s.name, s.surname").all(group.id) as StudentRow[];
  const rows = await Promise.all(students.map(async (student) => {
    let solved = student.solved_count; let unsolved = student.unsolved_count; let recent = { solved7: 0, solved14: 0, solved30: 0, solved90: 0, solved180: 0, solved365: 0 };
    const [profileResult, recentResult] = await Promise.allSettled([getAcmpProfile(student.acmp_id), getRecentSolvedCounts(student.acmp_id)]);
    if (profileResult.status === "fulfilled") { solved = profileResult.value.solvedProblems.length; unsolved = profileResult.value.unsolvedProblems.length; database.prepare("UPDATE students SET solved_count = ?, unsolved_count = ?, acmp_name = ?, last_synced = ? WHERE id = ?").run(solved, unsolved, profileResult.value.name, new Date().toISOString(), student.id); }
    if (recentResult.status === "fulfilled") recent = recentResult.value;
    const gifts = group.show_gifts ? database.prepare("SELECT * FROM student_rewards WHERE student_id = ? AND delivered = 1 ORDER BY target_solved").all(student.id) as RewardRow[] : [];
    return { ...student, solved_count: solved, unsolved_count: unsolved, ...recent, gifts };
  }));
  return { group: { name: group.name, slug: group.slug, showGifts: Boolean(group.show_gifts) }, students: rows, updatedAt: new Date().toISOString() } satisfies StandingPayload;
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const slug = (await context.params).slug; const refresh = new URL(request.url).searchParams.get("refresh") === "1"; const cached = cache.get(slug);
  if (!refresh && cached && cached.expires > Date.now()) return NextResponse.json(cached.payload);
  const payload = await buildStandings(slug); if (!payload) return NextResponse.json({ error: "Group not found." }, { status: 404 });
  cache.set(slug, { payload, expires: Date.now() + 300_000 }); return NextResponse.json(payload);
}
