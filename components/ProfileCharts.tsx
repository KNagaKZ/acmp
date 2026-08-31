"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AcmpProfile } from "@/lib/acmp";

const colors = ["#36c88a", "#ff637c", "#f2a744", "#7868ff", "#55a7ff", "#d46cf0", "#8e96a8"];
const tooltipStyle = { borderRadius: 10, border: "1px solid #303646", background: "#171b27", fontSize: 11 };

export function ProfileCharts({ profile }: { profile: AcmpProfile }) {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const verdictNames: Record<string, string> = { accepted: "Accepted", wrongAnswer: "Wrong answer", timeLimitExceeded: "Time limit", presentationError: "Presentation", compilationError: "Compilation", memoryLimitExceeded: "Memory limit", runtimeError: "Runtime" };
  const verdictData = Object.entries(profile.verdicts).flatMap(([key, value]) => typeof value === "number" && value > 0 ? [{ name: verdictNames[key], value }] : []);
  const attemptData = [{ name: "Solved", value: profile.solvedProblems.length }, { name: "Unsolved", value: profile.unsolvedProblems.length }];
  const selectedTagData = profile.topicAnalysis.stats.find((tag) => tag.name === selectedTag);
  const selectedDifficultyData = profile.difficultyAnalysis.distribution.find((band) => band.name === selectedDifficulty);

  return <div className="charts-grid">
    <ChartCard title="Verdict distribution" subtitle="Every recorded submission result">
      <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={verdictData} dataKey="value" innerRadius="58%" outerRadius="84%" paddingAngle={2} stroke="none">{verdictData.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="donut-label"><b>{profile.totalSubmissions?.toLocaleString() ?? "—"}</b><span>submissions</span></div></div>
      <div className="mini-legend">{verdictData.map((item, index) => <span key={item.name}><i style={{ background: colors[index % colors.length] }} />{item.name}</span>)}</div>
    </ChartCard>
    <ChartCard title="Problem outcomes" subtitle="Unique attempted problems">
      <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={attemptData} dataKey="value" innerRadius="58%" outerRadius="84%" paddingAngle={3} stroke="none"><Cell fill="#36c88a" /><Cell fill="#ff637c" /></Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="donut-label"><b>{profile.solvedProblems.length + profile.unsolvedProblems.length}</b><span>attempted</span></div></div>
      <div className="mini-legend"><span><i style={{ background: "#36c88a" }} />Solved</span><span><i style={{ background: "#ff637c" }} />Unsolved</span></div>
    </ChartCard>
    <ChartCard title="Solved difficulty distribution" subtitle="ACMP difficulty percentage bands" wide>
      <div className="bar-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={profile.difficultyAnalysis.distribution} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}><CartesianGrid vertical={false} stroke="#292e3c" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#8e96a8", fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#8e96a8", fontSize: 10 }} /><Tooltip cursor={{ fill: "#ffffff08" }} contentStyle={tooltipStyle} /><Bar dataKey="count" name="Solved" fill="#7868ff" radius={[6, 6, 0, 0]} cursor="pointer" onClick={(entry) => entry.name && setSelectedDifficulty(entry.name)} /></BarChart></ResponsiveContainer></div>
      <div className="difficulty-band-list">{profile.difficultyAnalysis.distribution.filter((band) => band.count > 0).map((band) => <button className={selectedDifficulty === band.name ? "active" : ""} onClick={() => setSelectedDifficulty(band.name)} key={band.name}><span>{band.name}%</span><b>{band.count}</b></button>)}</div>
      {selectedDifficultyData && <div className="tag-problems difficulty-problems"><header><div><span>SELECTED DIFFICULTY</span><h4>{selectedDifficultyData.name}% <b>{selectedDifficultyData.count}</b></h4></div><button onClick={() => setSelectedDifficulty(null)}>Clear ×</button></header><div>{selectedDifficultyData.problems.map((problem) => <a key={problem.id} href={problem.url} target="_blank" rel="noreferrer"><span>#{problem.id}</span><p><b>{problem.title}</b><small>{[`Difficulty ${problem.difficulty}%`, problem.tag].filter(Boolean).join(" · ")}</small></p><i>↗</i></a>)}</div></div>}
    </ChartCard>
    <ChartCard title="Tags solved" subtitle={`ACMP topic mapping · ${profile.topicAnalysis.mappedProblems} of ${profile.topicAnalysis.totalSolved} solved mapped`} wide>
      <div className="topic-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={profile.topicAnalysis.stats.slice(0, 18)} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 45 }}><CartesianGrid horizontal={false} stroke="#292e3c" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#8e96a8", fontSize: 9 }} /><YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fill: "#8e96a8", fontSize: 9 }} /><Tooltip cursor={{ fill: "#ffffff08" }} contentStyle={tooltipStyle} /><Bar dataKey="count" name="Solved" fill="#f2a744" radius={[0, 5, 5, 0]} cursor="pointer" onClick={(entry) => entry.name && setSelectedTag(entry.name)} /></BarChart></ResponsiveContainer></div>
      <div className="tag-cloud">{profile.topicAnalysis.stats.map((tag) => <button className={selectedTag === tag.name ? "active" : ""} onClick={() => setSelectedTag(tag.name)} key={tag.name}>{tag.name}<b>{tag.count}</b></button>)}</div>
      {selectedTagData && <div className="tag-problems"><header><div><span>SELECTED TAG</span><h4>{selectedTagData.name} <b>{selectedTagData.count}</b></h4></div><button onClick={() => setSelectedTag(null)}>Clear ×</button></header><div>{selectedTagData.problems.map((problem) => <a key={problem.id} href={problem.url} target="_blank" rel="noreferrer"><span>#{problem.id}</span><p><b>{problem.title}</b><small>{problem.difficulty === undefined ? "Difficulty unavailable" : `Difficulty ${problem.difficulty}%`}</small></p><i>↗</i></a>)}</div></div>}
    </ChartCard>
  </div>;
}

function ChartCard({ title, subtitle, wide, children }: { title: string; subtitle: string; wide?: boolean; children: React.ReactNode }) {
  return <article className={`card chart-card${wide ? " chart-wide" : ""}`}><header className="card-title"><h3>{title}</h3><p>{subtitle}</p></header>{children}</article>;
}
