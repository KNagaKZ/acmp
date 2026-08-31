import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "acmp_teacher_session";
const sessionLifetime = 60 * 60 * 24 * 7;

function secret() {
  const value = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "development" ? "acmp-visualizer-local-development-secret-change-me" : undefined);
  if (!value) throw new Error("AUTH_SECRET must be configured in production.");
  return new TextEncoder().encode(value);
}

export interface TeacherSession { teacherId: number; name: string; surname: string; email: string; isSuperAdmin: boolean; mustChangePassword: boolean }

export async function createSession(session: TeacherSession) {
  const token = await new SignJWT({ ...session }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${sessionLifetime}s`).sign(secret());
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionLifetime });
}

export async function getSession(): Promise<TeacherSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.teacherId !== "number" || typeof payload.email !== "string") return null;
    return { teacherId: payload.teacherId, name: String(payload.name ?? ""), surname: String(payload.surname ?? ""), email: payload.email, isSuperAdmin: Boolean(payload.isSuperAdmin), mustChangePassword: Boolean(payload.mustChangePassword) };
  } catch { return null; }
}

export async function deleteSession() {
  (await cookies()).delete(COOKIE_NAME);
}
