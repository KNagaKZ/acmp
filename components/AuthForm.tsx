"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push(data.mustChangePassword ? "/set-password" : data.isSuperAdmin ? "/admin" : "/dashboard"); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Something went wrong."); }
    finally { setLoading(false); }
  }
  return <main className="auth-page"><Link className="auth-brand" href="/"><span>A</span> ACMP Visualizer</Link><section className="auth-card"><span className="eyebrow">{mode === "login" ? "ACCOUNT LOGIN" : "TEACHER ACCOUNT"}</span><h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1><p>{mode === "login" ? "Teachers use their email. Super admin uses the admin username." : "Start building and tracking your ACMP class."}</p><form onSubmit={submit}>{mode === "register" && <div className="field-row"><label>Name<input name="name" required autoComplete="given-name" /></label><label>Surname<input name="surname" required autoComplete="family-name" /></label></div>}<label>{mode === "login" ? "Email or admin username" : "Email"}<input name="email" type={mode === "login" ? "text" : "email"} required autoComplete="username" /></label><label>Password<input name="password" type="password" required minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>{error && <div className="auth-error">{error}</div>}<button disabled={loading}>{loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}</button></form><small>{mode === "login" ? <>No account? <Link href="/register">Register as teacher</Link></> : <>Already registered? <Link href="/login">Log in</Link></>}</small></section></main>;
}
