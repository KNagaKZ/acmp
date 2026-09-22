"use client";

import { FormEvent, useMemo, useState } from "react";
import type { AcmpProfile } from "@/lib/acmp";
import { improvementAreas, recommendations, skillMap, strongestAreas, topicMetrics } from "@/lib/analytics/profile";

export function ProfileSearch({ compact=false }: { compact?: boolean }) {
  const [id,setId]=useState(""); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
  async function submit(e:FormEvent){e.preventDefault(); const value=id.trim(); if(!/^\d+$/.test(value)||value==="0"){setError("Enter a valid numeric ACMP profile ID.");return} setLoading(true);setError(""); location.href=`/?profile=${value}`;}
  return <div className={compact?"profile-search compact":"profile-search"}><form onSubmit={submit}><input aria-label="ACMP Profile ID" inputMode="numeric" placeholder="Enter ACMP Profile ID" value={id} onChange={e=>setId(e.target.value)}/><button disabled={loading}>{loading?"Analyzing…":"Analyze Profile →"}</button></form>{error?<p className="form-error">{error}</p>:<small>Example: acmp.ru/?main=user&amp;id=507696</small>}</div>;
}

export function StatCard({value,label,note}:{value:string|number;label:string;note?:string}){return <article className="metric-card"><b>{value}</b><span>{label}</span>{note&&<small>{note}</small>}</article>}

export function ProfileDashboard({profile}:{profile:AcmpProfile}){
 const topics=useMemo(()=>topicMetrics(profile.topicAnalysis.stats,profile.topicAnalysis.totalSolved),[profile]);
 const skills=useMemo(()=>skillMap(profile.topicAnalysis.stats,profile.topicAnalysis.totalSolved),[profile]);
 const strong=strongestAreas(profile.topicAnalysis.stats); const improve=improvementAreas(profile.topicAnalysis.stats,profile.topicAnalysis.totalSolved);
 const recs=recommendations(profile.topicAnalysis.stats,profile.topicAnalysis.totalSolved); const top=strong[0];
 return <div className="dashboard-stack">
  <section className="profile-head"><div><span className="kicker">STUDENT PROFILE · ACMP {profile.id}</span><h1>{profile.name}</h1><p>Real ACMP data, translated into a clearer picture of topic coverage and next steps.</p></div><a className="ghost-button" href={profile.sourceUrl} target="_blank" rel="noreferrer">Open on ACMP ↗</a></section>
  <section className="metric-grid"><StatCard value={profile.solvedProblems.length} label="Problems Solved"/><StatCard value={profile.topicAnalysis.stats.length} label="Topics Detected" note={`${profile.topicAnalysis.mappedProblems} problems mapped`}/><StatCard value={top?.count??"—"} label={top?.name??"Strongest Topic"}/><StatCard value={profile.difficultyAnalysis.average===undefined?"—":`${profile.difficultyAnalysis.average}%`} label="Avg. Difficulty"/></section>
  <section className="analytics-grid"><article className="panel span-2"><header><div><span className="kicker">DISTRIBUTION</span><h2>Topic Performance</h2></div><span>{profile.topicAnalysis.mappedProblems}/{profile.topicAnalysis.totalSolved} mapped</span></header><div className="topic-bars">{topics.map(t=><div className="topic-row" key={t.name}><span>{t.name}</span><div><i style={{width:`${Math.max(2,t.share)}%`}}/></div><b>{t.count}</b><small>{t.share.toFixed(1)}%</small></div>)}</div></article>
  <article className="panel"><header><div><span className="kicker">COVERAGE</span><h2>Skill Map</h2></div></header><div className="skill-list">{skills.map(s=><div key={s.name}><span><b>{s.name}</b><small>{s.solved} mapped solves</small></span><em data-level={s.level}>{s.level}</em></div>)}</div></article></section>
  <section className="two-col"><AreaPanel title="Strongest Areas" items={strong}/><AreaPanel title="Topics to Develop" items={improve} empty="Not enough evidence yet to identify development areas."/></section>
  <section className="panel"><header><div><span className="kicker">NEXT STEPS</span><h2>Recommended Next Topics</h2></div><p>Recommendations use your topic distribution, not a fixed user template.</p></header>{recs.length?<div className="recommend-grid">{recs.map(r=><article className="recommend" key={r.topic}><div><span>{r.level}</span><h3>{r.topic}</h3></div><p>{r.reason}</p><footer><b>Current: {r.current}</b><span>Target: {r.target} problems</span></footer><a href={`https://acmp.ru/index.asp?main=tasks`} target="_blank" rel="noreferrer">Practice this topic →</a></article>)}</div>:<Empty title="More data needed" text="Solve more mapped problems before we suggest a focused next topic."/>}</section>
  <section className="two-col"><Future title="Progress" text="Historical snapshots are not stored for every profile yet. The existing period-analysis service can power this view once snapshot persistence is added."/><Future title="Solving Activity" text="Daily history is available only when ACMP submission history can be retrieved. No activity is fabricated."/></section>
 </div>
}

function AreaPanel({title,items,empty}:{title:string;items:{name:string;count:number}[];empty?:string}){return <article className="panel"><header><h2>{title}</h2></header>{items.length?<div className="ranked-list">{items.map((x,i)=><div key={x.name}><span><i>{String(i+1).padStart(2,"0")}</i><b>{x.name}</b></span><strong>{x.count} solved</strong></div>)}</div>:<Empty title="No signal yet" text={empty??"No data available."}/>}</article>}
function Future({title,text}:{title:string;text:string}){return <article className="panel future"><header><h2>{title}</h2><span>DATA-READY</span></header><Empty title="History not available yet" text={text}/></article>}
function Empty({title,text}:{title:string;text:string}){return <div className="empty-state"><b>{title}</b><p>{text}</p></div>}
