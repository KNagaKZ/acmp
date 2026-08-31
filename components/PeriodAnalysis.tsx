"use client";

import { FormEvent, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Problem { id: number; title: string; difficulty?: number; tag?: string; url: string }
interface PeriodData {
  from: string; to: string; totalSubmissions: number; acceptedSubmissions: number; uniqueAcceptedProblems: number; acceptanceRate: number;
  daily: { date: string; submissions: number; accepted: number }[]; verdicts: { name: string; count: number }[];
  topics: { name: string; count: number }[]; difficulty: { name: string; count: number }[]; problems: Problem[];
  dailyProblems: { date: string; problems: Problem[] }[];
}

const colors = ["#36c88a", "#ff637c", "#f2a744", "#7868ff", "#55a7ff", "#d46cf0", "#8e96a8"];
const tooltipStyle = { borderRadius: 10, border: "1px solid #303646", background: "#171b27", fontSize: 11 };
const currentYear = new Date().getFullYear();
const displayDate = (value: string) => value.split("-").reverse().join(".");
const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export function PeriodAnalysis({ userId }: { userId: string }) {
  const [year, setYear] = useState(currentYear); const [data, setData] = useState<PeriodData | null>(null); const [selectedDate, setSelectedDate] = useState<string | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const years = Array.from({ length: currentYear - 2005 }, (_, index) => currentYear - index);
  async function analyze(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); setSelectedDate(null); try { const response = await fetch(`/api/profile/${userId}/period?from=${year}-01-01&to=${year}-12-31`); const result = await response.json(); if (!response.ok) throw new Error(result.error); setData(result); } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load yearly analysis."); } finally { setLoading(false); } }
  return <article className="period-section card"><header className="period-header"><div><span className="eyebrow">YEARLY ANALYSIS</span><h2>Explore a full year</h2><p>Choose a year to rebuild every statistic and chart from that year&apos;s public ACMP submissions.</p></div><form onSubmit={analyze}><label>YEAR<select value={year} onChange={(event) => setYear(Number(event.target.value))}>{years.map((item) => <option key={item}>{item}</option>)}</select></label><button disabled={loading}>{loading ? "Analyzing…" : "Analyze year"}</button></form></header>{error && <div className="auth-error">{error}</div>}
    {data && <PeriodResults data={data} year={Number(data.from.slice(0, 4))} selectedDate={selectedDate} onSelectDate={setSelectedDate} />}
  </article>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div><span>{label}</span><b>{value}</b></div>; }
function Chart({ title, wide, children }: { title: string; wide?: boolean; children: React.ReactNode }) { return <section className={wide ? "period-chart wide" : "period-chart"}><h3>{title}</h3><div>{children}</div></section>; }

function longestStreak(days: PeriodData["daily"]) {
  const active = [...days].filter((day) => day.submissions > 0).map((day) => new Date(`${day.date}T00:00:00Z`).getTime()).sort((a, b) => a - b);
  let longest = 0, run = 0, previous = 0;
  for (const day of active) { run = previous && day - previous === 86_400_000 ? run + 1 : 1; longest = Math.max(longest, run); previous = day; }
  return longest;
}

function YearHeatmap({ year, daily, selectedDate, onSelectDate }: { year: number; daily: PeriodData["daily"]; selectedDate: string | null; onSelectDate: (date: string) => void }) {
  const { cells, months, max } = useMemo(() => {
    const byDate = new Map(daily.map((day) => [day.date, day])); const first = new Date(Date.UTC(year, 0, 1)); const last = new Date(Date.UTC(year, 11, 31)); const leading = (first.getUTCDay() + 6) % 7;
    const result: ({ date: string; submissions: number; accepted: number } | null)[] = Array(leading).fill(null); const labels: { label: string; column: number }[] = [];
    for (const date = new Date(first); date <= last; date.setUTCDate(date.getUTCDate() + 1)) { const key = isoDate(date); if (date.getUTCDate() === 1) labels.push({ label: date.toLocaleString("en", { month: "short", timeZone: "UTC" }), column: Math.floor((leading + Math.round((date.getTime() - first.getTime()) / 86_400_000)) / 7) + 1 }); const value = byDate.get(key); result.push({ date: key, submissions: value?.submissions ?? 0, accepted: value?.accepted ?? 0 }); }
    return { cells: result, months: labels, max: Math.max(1, ...daily.map((day) => day.submissions)) };
  }, [daily, year]);
  return <section className="year-heatmap"><header><div><span className="eyebrow">ACTIVITY CALENDAR</span><h3>{year} submission activity</h3></div><div className="heat-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((level) => <i className={`level-${level}`} key={level} />)}<span>More</span></div></header><div className="heatmap-scroll"><div className="heatmap-layout"><div /><div className="heatmap-months">{months.map((month) => <span key={month.label} style={{ gridColumn: month.column }}>{month.label}</span>)}</div><div className="heatmap-weekdays"><span>Mon</span><span>Wed</span><span>Fri</span></div><div className="heatmap-grid">{cells.map((day, index) => day ? <button type="button" key={day.date} aria-label={`${displayDate(day.date)}: ${day.submissions} submissions, ${day.accepted} accepted`} title={`${displayDate(day.date)} · ${day.submissions} submissions · ${day.accepted} accepted`} className={`heat-cell level-${day.submissions === 0 ? 0 : Math.max(1, Math.ceil(day.submissions / max * 4))} ${selectedDate === day.date ? "selected" : ""}`} onClick={() => onSelectDate(day.date)} /> : <i key={`empty-${index}`} />)}</div></div></div><p>Click any day to show only the problems solved on that date.</p></section>;
}

function PeriodResults({ data, year, selectedDate, onSelectDate }: { data: PeriodData; year: number; selectedDate: string | null; onSelectDate: (date: string | null) => void }) {
  const selectedProblems = selectedDate ? data.dailyProblems.find((day) => day.date === selectedDate)?.problems ?? [] : data.problems;
  const activeDays = data.daily.filter((day) => day.submissions > 0).length; const bestDay = data.daily.reduce<(typeof data.daily)[number] | null>((best, day) => !best || day.submissions > best.submissions ? day : best, null);
  return <div className="period-results"><div className="period-label">JANUARY — DECEMBER {year}</div><div className="period-stats year-stats"><Metric label="Problems solved" value={data.uniqueAcceptedProblems} /><Metric label="Submissions" value={data.totalSubmissions} /><Metric label="Active days" value={activeDays} /><Metric label="Longest streak" value={`${longestStreak(data.daily)} days`} /><Metric label="Acceptance rate" value={`${data.acceptanceRate}%`} /><Metric label="Busiest day" value={bestDay && bestDay.submissions ? `${displayDate(bestDay.date)} · ${bestDay.submissions}` : "—"} /></div><YearHeatmap year={year} daily={data.daily} selectedDate={selectedDate} onSelectDate={onSelectDate} />{data.totalSubmissions === 0 ? <div className="period-empty">No submissions were found in {year}.</div> : <><div className="period-charts"><Chart title="Daily activity — select a date" wide><ResponsiveContainer width="100%" height="100%"><LineChart data={data.daily} margin={{ top: 10, right: 15, left: -18, bottom: 0 }} onClick={(point) => point?.activeLabel && onSelectDate(String(point.activeLabel))} style={{ cursor: "pointer" }}><CartesianGrid vertical={false} stroke="#292e3c" /><XAxis dataKey="date" tickFormatter={(value) => displayDate(value).slice(0, 5)} tick={{ fill: "#8e96a8", fontSize: 8 }} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#8e96a8", fontSize: 9 }} tickLine={false} axisLine={false} /><Tooltip labelFormatter={(value) => displayDate(String(value))} contentStyle={tooltipStyle} /><Line type="monotone" dataKey="submissions" stroke="#7868ff" strokeWidth={2} dot={false} activeDot={{ r: 6 }} /><Line type="monotone" dataKey="accepted" stroke="#36c88a" strokeWidth={2} dot={false} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></Chart><Chart title="Verdicts"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.verdicts} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="82%" paddingAngle={2} stroke="none">{data.verdicts.map((_, index) => <Cell key={index} fill={colors[index % colors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer></Chart><Chart title="Solved by topic" wide><ResponsiveContainer width="100%" height="100%"><BarChart data={data.topics.slice(0, 12)} layout="vertical" margin={{ top: 4, right: 18, left: 35 }}><CartesianGrid horizontal={false} stroke="#292e3c" /><XAxis type="number" allowDecimals={false} tick={{ fill: "#8e96a8", fontSize: 8 }} /><YAxis type="category" dataKey="name" width={105} tick={{ fill: "#8e96a8", fontSize: 8 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#f2a744" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></Chart><Chart title="Solved difficulty"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.difficulty} margin={{ top: 8, right: 10, left: -18 }}><CartesianGrid vertical={false} stroke="#292e3c" /><XAxis dataKey="name" tick={{ fill: "#8e96a8", fontSize: 8 }} /><YAxis allowDecimals={false} tick={{ fill: "#8e96a8", fontSize: 8 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#55a7ff" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></Chart></div><details className="period-problems" open={Boolean(selectedDate)}><summary>{selectedDate ? `Problems solved on ${displayDate(selectedDate)} (${selectedProblems.length})` : `Problems solved in ${year} (${selectedProblems.length})`}</summary>{selectedDate && <button className="clear-date" onClick={() => onSelectDate(null)}>Show entire year ×</button>}<div>{selectedProblems.map((problem) => <a href={problem.url} target="_blank" rel="noreferrer" key={problem.id}><span>#{problem.id}</span><p><b>{problem.title}</b><small>{[problem.tag, problem.difficulty === undefined ? "Difficulty unavailable" : `Difficulty ${problem.difficulty}%`].filter(Boolean).join(" · ")}</small></p><i>↗</i></a>)}</div>{selectedDate && selectedProblems.length === 0 && <div className="no-daily-solves">No accepted problems on this date.</div>}</details></>}</div>;
}

