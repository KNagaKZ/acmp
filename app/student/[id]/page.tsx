import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import database, { type StudentRow } from "@/lib/db";
import { getAcmpProfile } from "@/lib/acmp";
import { StudentAnalysis } from "@/components/StudentAnalysis";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(); if (!session) redirect("/login");
  const { id } = await params;
  const student = database.prepare("SELECT * FROM students WHERE id = ? AND teacher_id = ?").get(id, session.teacherId) as StudentRow | undefined;
  if (!student) notFound();
  const profile = await getAcmpProfile(student.acmp_id);
  return <StudentAnalysis student={student} profile={profile} />;
}
