import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import database from "@/lib/db";
export async function GET() { const session = await getSession(); if (!session?.isSuperAdmin) return NextResponse.json({ error: "Forbidden." }, { status: 403 }); const teachers = database.prepare("SELECT id,name,surname,email,is_super_admin,must_change_password,created_at,(SELECT COUNT(*) FROM students s WHERE s.teacher_id=teachers.id) student_count FROM teachers ORDER BY created_at").all(); const students = database.prepare("SELECT s.*, t.name teacher_name, t.surname teacher_surname FROM students s JOIN teachers t ON t.id=s.teacher_id ORDER BY s.name,s.surname").all(); return NextResponse.json({ teachers, students }); }
