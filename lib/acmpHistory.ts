import * as cheerio from "cheerio";
import { getAcmpProfile } from "@/lib/acmp";

interface Submission { id: number; date: string; time: string; problemId: number; language: string; verdict: string }

function isoDate(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
  return match ? { date: `${match[3]}-${match[2]}-${match[1]}`, time: match[4] } : null;
}

async function fetchHistoryPage(userId: string, page: number): Promise<Submission[]> {
  const url = `https://acmp.ru/index.asp?id_mem=${encodeURIComponent(userId)}&id_res=0&id_t=0&main=status&page=${page}`;
  const response = await fetch(url, { headers: { "User-Agent": "ACMP-Visualizer/1.0 (public profile analyzer)" }, next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`ACMP history returned HTTP ${response.status}`);
  const html = new TextDecoder("windows-1251").decode(await response.arrayBuffer());
  const $ = cheerio.load(html); const submissions: Submission[] = [];
  $("tr").each((_, row) => {
    const cells = $(row).find("td");
    const submissionId = cells.eq(0).text().trim(); const parsedDate = isoDate(cells.eq(1).text().replace(/\s+/g, " ").trim());
    const problemId = cells.eq(3).text().trim();
    if (!/^\d+$/.test(submissionId) || !parsedDate || !/^\d+$/.test(problemId)) return;
    submissions.push({ id: Number(submissionId), date: parsedDate.date, time: parsedDate.time, problemId: Number(problemId), language: cells.eq(4).text().trim(), verdict: cells.eq(5).text().replace(/\s+/g, " ").trim() });
  });
  return submissions;
}

export async function getPeriodAnalysis(userId: string, from: string, to: string) {
  if (!/^\d+$/.test(userId) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) throw new Error("Invalid date range.");
  const rangeDays = Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  if (rangeDays > 1096) throw new Error("Choose a period of three years or less.");
  const selected: Submission[] = []; let scannedPages = 0; let finished = false;
  for (let startPage = 0; startPage < 160 && !finished; startPage += 4) {
    const batch = await Promise.all(Array.from({ length: 4 }, (_, offset) => fetchHistoryPage(userId, startPage + offset)));
    scannedPages += batch.length;
    for (const page of batch) {
      if (!page.length) { finished = true; break; }
      selected.push(...page.filter((submission) => submission.date >= from && submission.date <= to));
      if (page.some((submission) => submission.date < from)) { finished = true; break; }
    }
  }
  const profile = await getAcmpProfile(userId);
  const problemMetadata = new Map(profile.topicAnalysis.stats.flatMap((tag) => tag.problems.map((problem) => [problem.id, { ...problem, tag: tag.name }] as const)));
  const accepted = selected.filter((submission) => submission.verdict.toLowerCase() === "accepted");
  const acceptedProblemIds = [...new Set(accepted.map((submission) => submission.problemId))];
  const verdictMap = new Map<string, number>(); const dailyMap = new Map<string, { submissions: number; accepted: number }>();
  selected.forEach((submission) => {
    verdictMap.set(submission.verdict, (verdictMap.get(submission.verdict) ?? 0) + 1);
    const day = dailyMap.get(submission.date) ?? { submissions: 0, accepted: 0 }; day.submissions += 1; if (submission.verdict.toLowerCase() === "accepted") day.accepted += 1; dailyMap.set(submission.date, day);
  });
  const topicMap = new Map<string, number>(); const difficultyMap = new Map<string, number>();
  acceptedProblemIds.forEach((id) => {
    const problem = problemMetadata.get(id); if (!problem) return;
    topicMap.set(problem.tag, (topicMap.get(problem.tag) ?? 0) + 1);
    if (problem.difficulty !== undefined) { const lower = Math.floor(Math.max(0, problem.difficulty - 1) / 5) * 5 + 1; const band = `${lower}–${lower + 4}`; difficultyMap.set(band, (difficultyMap.get(band) ?? 0) + 1); }
  });
  const dailyProblems = [...new Set(accepted.map((submission) => submission.date))].sort().map((date) => {
    const ids = [...new Set(accepted.filter((submission) => submission.date === date).map((submission) => submission.problemId))];
    return { date, problems: ids.map((id) => problemMetadata.get(id) ?? { id, title: `ACMP Problem ${id}`, url: `https://acmp.ru/index.asp?main=task&id_task=${id}` }) };
  });
  return {
    from, to, scannedPages, totalSubmissions: selected.length, acceptedSubmissions: accepted.length, uniqueAcceptedProblems: acceptedProblemIds.length,
    acceptanceRate: selected.length ? Math.round(accepted.length / selected.length * 100) : 0,
    daily: [...dailyMap].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => ({ date, ...values })),
    verdicts: [...verdictMap].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    topics: [...topicMap].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    difficulty: [...difficultyMap].map(([name, count]) => ({ name, count })).sort((a, b) => Number(a.name.split("–")[0]) - Number(b.name.split("–")[0])),
    problems: acceptedProblemIds.map((id) => problemMetadata.get(id) ?? { id, title: `ACMP Problem ${id}`, url: `https://acmp.ru/index.asp?main=task&id_task=${id}` }),
    dailyProblems,
  };
}

export async function getRecentSolvedCounts(userId: string) {
  const today = new Date(); const to = today.toISOString().slice(0, 10);
  const boundary = (days: number) => { const date = new Date(today); date.setUTCDate(date.getUTCDate() - (days - 1)); return date.toISOString().slice(0, 10); };
  const from7 = boundary(7); const from14 = boundary(14); const from30 = boundary(30); const from90 = boundary(90); const from180 = boundary(180); const from365 = boundary(365);
  const submissions: Submission[] = [];
  for (let page = 0; page < 160; page += 4) {
    const batch = await Promise.all(Array.from({ length: 4 }, (_, offset) => fetchHistoryPage(userId, page + offset)));
    let finished = false;
    for (const rows of batch) { if (!rows.length) { finished = true; break; } submissions.push(...rows.filter((item) => item.date >= from365 && item.date <= to)); if (rows.some((item) => item.date < from365)) { finished = true; break; } }
    if (finished) break;
  }
  const accepted = submissions.filter((item) => item.verdict.toLowerCase() === "accepted");
  const countSince = (from: string) => new Set(accepted.filter((item) => item.date >= from).map((item) => item.problemId)).size;
  return { solved7: countSince(from7), solved14: countSince(from14), solved30: countSince(from30), solved90: countSince(from90), solved180: countSince(from180), solved365: countSince(from365) };
}
