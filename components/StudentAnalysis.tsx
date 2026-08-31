import type { AcmpProfile } from "@/lib/acmp";
import type { StudentRow } from "@/lib/db";
import { AnalyticsScope } from "@/components/AnalyticsScope";

export function StudentAnalysis({ student, profile }: { student: StudentRow; profile: AcmpProfile }) {
  return <main className="student-analysis-shell"><header className="analysis-nav"><a className="brand" href="/dashboard"><span>A</span><b>ACMP Visualizer</b></a><a href="/dashboard">← Teacher dashboard</a></header><section className="analysis-content"><article className="profile-banner"><div className="avatar">{student.name.slice(0, 2).toUpperCase()}</div><div><span>STUDENT · ACMP ID {student.acmp_id}</span><h2>{[student.name, student.surname].filter(Boolean).join(" ")}</h2><p>{profile.name} · {profile.lastVisit ? `Last visited ${profile.lastVisit}` : "Last visit unavailable"}</p></div><a href={profile.sourceUrl} target="_blank" rel="noreferrer">Open ACMP ↗</a></article><AnalyticsScope profile={profile} /></section></main>;
}
