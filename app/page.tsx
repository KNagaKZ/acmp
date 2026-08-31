"use client";

import { FormEvent, useState } from "react";
import type { AcmpProfile } from "@/lib/acmp";
import { AnalyticsScope } from "@/components/AnalyticsScope";

export default function Home() {
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<AcmpProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyzeProfile(event: FormEvent) {
    event.preventDefault();
    const id = userId.trim();
    if (!/^\d+$/.test(id) || id === "0") { setError("Enter a valid numeric ACMP user ID."); return; }
    setLoading(true); setError(""); setProfile(null);
    try {
      const response = await fetch(`/api/profile/${id}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load this profile.");
      setProfile(data);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Could not load this profile."); }
    finally { setLoading(false); }
  }

  return <main className="page-shell">
    <header className="topbar"><div className="brand"><span>A</span><b>ACMP Visualizer</b></div><nav className="home-links"><a href="https://acmp.ru" target="_blank" rel="noreferrer">ACMP.ru ↗</a><a href="/login">Teacher login</a><a className="register-link" href="/register">Create account</a></nav></header>
    <section className="hero"><span className="eyebrow">PUBLIC PROFILE ANALYTICS</span><h1>Everything your ACMP<br />profile can tell you.</h1><p>Enter an ACMP user ID to retrieve current public statistics directly from the profile.</p>
      <form onSubmit={analyzeProfile} className="search"><input inputMode="numeric" placeholder="Enter ACMP user ID" value={userId} onChange={(event) => setUserId(event.target.value)} /><button disabled={loading}>{loading ? "Analyzing…" : "Analyze →"}</button></form>
      <small>Try user ID 470224</small>{error && <div className="error">{error}</div>}
    </section>
    {profile && <section className="results">
      <article className="profile-banner"><div className="avatar">{profile.name.slice(0, 2).toUpperCase()}</div><div><span>ACMP PROFILE · ID {profile.id}</span><h2>{profile.name}</h2><p>{profile.lastVisit ? `Last visited ${profile.lastVisit}` : "Last visit unavailable"}</p></div><a href={profile.sourceUrl} target="_blank" rel="noreferrer">Open profile ↗</a></article>
      <AnalyticsScope profile={profile} />
    </section>}
  </main>;
}
