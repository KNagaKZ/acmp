import { redirect } from "next/navigation";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { getSession } from "@/lib/auth";

export default async function DashboardPage() { const session = await getSession(); if (!session) redirect("/login"); if (session.mustChangePassword) redirect("/set-password"); return <TeacherDashboard teacherName={`${session.name} ${session.surname}`} />; }
