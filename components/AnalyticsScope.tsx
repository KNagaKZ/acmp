"use client";

import { useState } from "react";
import type { AcmpProfile } from "@/lib/acmp";
import { PeriodAnalysis } from "@/components/PeriodAnalysis";
import { ProfileCharts } from "@/components/ProfileCharts";

export function AnalyticsScope({ profile }: { profile: AcmpProfile }) {
  const [mode, setMode] = useState<"all" | "period">("all");
  return <section className="analytics-scope">
    <header className="scope-picker"><div><span className="eyebrow">ANALYSIS RANGE</span><h2>What do you want to analyze?</h2><p>Choose lifetime results or explore one calendar year.</p></div><div className="scope-options"><button className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}><i>∞</i><span><b>All time</b><small>Complete ACMP history</small></span></button><button className={mode === "period" ? "active" : ""} onClick={() => setMode("period")}><i>▣</i><span><b>Choose year</b><small>One calendar year</small></span></button></div></header>
    {mode === "period" ? <PeriodAnalysis userId={profile.id} /> : <AllTime profile={profile} />}
  </section>;
}

function AllTime({ profile }: { profile: AcmpProfile }) {
  const attempted = profile.solvedProblems.length + profile.unsolvedProblems.length;
  return <div className="all-time-analysis"><div className="stats"><Stat label="Solved" value={profile.solvedProblems.length} /><Stat label="Unsolved" value={profile.unsolvedProblems.length} /><Stat label="Global place" value={profile.rank ? `#${profile.rank.place.toLocaleString()}` : "—"} note={profile.rank ? `of ${profile.rank.total.toLocaleString()}` : undefined} /><Stat label="Rating" value={profile.rating?.value.toLocaleString() ?? "—"} note={profile.rating ? `of ${profile.rating.maximum.toLocaleString()}` : undefined} /><Stat label="Submissions" value={profile.totalSubmissions?.toLocaleString() ?? "—"} /></div><div className="derived-stats"><Stat label="Problem success rate" value={`${Math.round(profile.solvedProblems.length / Math.max(1, attempted) * 100)}%`} note="Solved ÷ unique attempted" /><Stat label="Submission acceptance" value={profile.totalSubmissions && profile.verdicts.accepted !== undefined ? `${Math.round(profile.verdicts.accepted / profile.totalSubmissions * 100)}%` : "—"} note="Accepted verdicts ÷ submissions" /><Stat label="Submissions per solve" value={profile.totalSubmissions ? (profile.totalSubmissions / Math.max(1, profile.solvedProblems.length)).toFixed(1) : "—"} note="All submissions ÷ solved problems" /></div><article className="card difficulty-summary"><CardTitle title="Solved problem difficulty" subtitle={`Calculated from ${profile.difficultyAnalysis.mappedProblems} of ${profile.difficultyAnalysis.totalSolved} solved problems with published ACMP difficulty`} /><div className="difficulty-cards"><div><span>AVERAGE DIFFICULTY</span><b>{profile.difficultyAnalysis.average === undefined ? "—" : `${profile.difficultyAnalysis.average}%`}</b><p>Arithmetic mean of published difficulty percentages</p></div><div><span>HARDEST SOLVED</span>{profile.difficultyAnalysis.hardest ? <><b>{profile.difficultyAnalysis.hardest.difficulty}%</b><a href={profile.difficultyAnalysis.hardest.url} target="_blank" rel="noreferrer">#{profile.difficultyAnalysis.hardest.id} · {profile.difficultyAnalysis.hardest.title} ↗</a></> : <b>—</b>}</div></div></article><ProfileCharts profile={profile} /><div className="content-grid problem-grid"><ProblemList title="Solved problems" ids={profile.solvedProblems} tone="solved" /><ProblemList title="Unsolved problems" ids={profile.unsolvedProblems} tone="unsolved" /></div></div>;
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) { return <article className="stat"><span>{label}</span><b>{value}</b>{note && <small>{note}</small>}</article>; }
function CardTitle({ title, subtitle }: { title: string; subtitle: string }) { return <header className="card-title"><h3>{title}</h3><p>{subtitle}</p></header>; }
function ProblemList({ title, ids, tone }: { title: string; ids: number[]; tone: string }) { return <article className="card"><CardTitle title={title} subtitle={`${ids.length} problems`} />{ids.length ? <details className="problems" open={ids.length <= 30}><summary>{ids.length > 30 ? "Show all problem IDs" : "Problem IDs"}</summary><div>{ids.map((id) => <a className={tone} key={id} href={`https://acmp.ru/index.asp?main=task&id_task=${id}`} target="_blank" rel="noreferrer">#{id}</a>)}</div></details> : <div className="empty">No {title.toLowerCase()} are listed.</div>}</article>; }
