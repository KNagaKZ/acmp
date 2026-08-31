import * as cheerio from "cheerio";

export interface AcmpProfile {
  id: string; name: string; sourceUrl: string;
  rank?: { place: number; total: number };
  rating?: { value: number; maximum: number };
  languages: { name: string; solved: number }[];
  solvedProblems: number[]; unsolvedProblems: number[];
  courseProgress: { name: string; percent?: number }[];
  lastVisit?: string;
  verdicts: { accepted?: number; wrongAnswer?: number; timeLimitExceeded?: number; presentationError?: number; compilationError?: number; memoryLimitExceeded?: number; runtimeError?: number };
  totalSubmissions?: number;
  difficultyAnalysis: {
    average?: number;
    hardest?: { id: number; title: string; difficulty: number; url: string };
    mappedProblems: number;
    totalSolved: number;
    distribution: { name: string; count: number; problems: { id: number; title: string; difficulty: number; tag?: string; url: string }[] }[];
  };
  topicAnalysis: {
    stats: { name: string; count: number; problems: { id: number; title: string; difficulty?: number; url: string }[] }[];
    mappedProblems: number;
    totalSolved: number;
  };
}

export class AcmpProfileError extends Error {
  constructor(public code: "INVALID_ID" | "NOT_FOUND" | "UPSTREAM", message: string) { super(message); }
}

const pair = (text: string, label: string) => {
  const m = text.match(new RegExp(`${label}\\s*:\\s*(\\d+)\\s*\\/\\s*(\\d+)`, "i"));
  return m ? [Number(m[1]), Number(m[2])] as const : undefined;
};
const count = (text: string, label: string) => {
  const m = text.match(new RegExp(`${label}\\s+(\\d+)`, "i"));
  return m ? Number(m[1]) : undefined;
};
const problemList = (text: string, label: string) => {
  const m = text.match(new RegExp(`${label}\\s*\\(\\d+\\)\\s*:\\s*([\\d\\s]+)`, "i"));
  return (m?.[1].match(/\d+/g) ?? []).map(Number);
};

async function fetchHtml(id: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://acmp.ru/index.asp?main=user&id=${encodeURIComponent(id)}`, {
      headers: { "User-Agent": "ACMP-Visualizer/1.0 (public profile analyzer)" },
      signal: controller.signal,
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new AcmpProfileError(response.status === 404 ? "NOT_FOUND" : "UPSTREAM", `ACMP returned HTTP ${response.status}.`);
    return new TextDecoder("windows-1251").decode(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof AcmpProfileError) throw error;
    throw new AcmpProfileError("UPSTREAM", error instanceof Error ? error.message : "Could not reach ACMP.");
  } finally { clearTimeout(timeout); }
}

async function getDifficultyCatalog() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch("https://acmp.ru/index.asp?main=alltasks", {
      headers: { "User-Agent": "ACMP-Visualizer/1.0 (public profile analyzer)" },
      signal: controller.signal,
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return new Map<number, { title: string; difficulty: number }>();
    const html = new TextDecoder("windows-1251").decode(await response.arrayBuffer());
    const catalog = new Map<number, { title: string; difficulty: number }>();
    const pageText = cheerio.load(html)("body").text().replace(/\u00a0/g, " ");
    for (const match of pageText.matchAll(/Задача\s*№\s*(\d+)\s*([^\r\n]+?)\s*[\r\n]+[\s\S]{0,180}?Сложность\s*:\s*(\d+)%/gi)) {
      catalog.set(Number(match[1]), { title: match[2].trim(), difficulty: Number(match[3]) });
    }
    return catalog;
  } catch {
    return new Map<number, { title: string; difficulty: number }>();
  } finally { clearTimeout(timeout); }
}

const topicAliases: Record<string, string> = {
  "Задачи для начинающих": "implementation",
  "Целочисленная арифметика": "math",
  "Простая математика": "math",
  "Математическое моделирование": "math",
  "Сортировка и последовательности": "sortings",
  "Разбор строк": "strings",
  "Динамическое программирование": "dp",
  "Теория графов": "graphs",
  "Рекурсия, перебор": "brute force",
  "Жадный алгоритм": "greedy",
  "Геометрия": "geometry",
  "Комбинаторика": "combinatorics",
  "Длинная арифметика": "number theory",
  "Системы счисления": "number theory",
  "Двумерные массивы": "arrays",
};

async function getTopicCatalog(solvedIds: number[]) {
  const pages = [...new Set(solvedIds.filter((id) => id >= 1 && id <= 1000).map((id) => Math.floor((id - 1) / 50)))];
  const catalog = new Map<number, string>();
  for (let offset = 0; offset < pages.length; offset += 4) {
    const batch = pages.slice(offset, offset + 4);
    const results = await Promise.all(batch.map(async (page) => {
      try {
        const url = page === 0 ? "https://acmp.ru/index.asp?main=tasks" : `https://acmp.ru/index.asp?id_type=0&main=tasks&page=${page}&str=+`;
        const response = await fetch(url, { headers: { "User-Agent": "ACMP-Visualizer/1.0 (public profile analyzer)" }, next: { revalidate: 86_400 } });
        if (!response.ok) return [] as [number, string][];
        const html = new TextDecoder("windows-1251").decode(await response.arrayBuffer());
        const $ = cheerio.load(html);
        const rows: [number, string][] = [];
        $("tr").each((_, row) => {
          const cells = $(row).find("td");
          const idText = cells.eq(0).text().trim();
          if (!/^\d{4}$/.test(idText) || cells.length < 3) return;
          const topic = cells.eq(2).text().replace(/\s+/g, " ").trim();
          if (topic) rows.push([Number(idText), topicAliases[topic] ?? topic.toLowerCase()]);
        });
        return rows;
      } catch { return [] as [number, string][]; }
    }));
    results.flat().forEach(([id, topic]) => catalog.set(id, topic));
  }
  return catalog;
}

export async function getAcmpProfile(id: string): Promise<AcmpProfile> {
  if (!/^\d+$/.test(id) || id === "0") throw new AcmpProfileError("INVALID_ID", "ACMP ID must be a positive number.");
  const html = await fetchHtml(id);
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  if (!/Общая статистика/i.test(text)) throw new AcmpProfileError("NOT_FOUND", "This public ACMP profile does not exist.");
  const general = text.split(/Статистика раздела\s*["«]Курсы["»]/i)[0];
  const rank = pair(general, "Место");
  const rating = pair(general, "Рейтинг");
  const languageBlock = general.match(/Язык\s*:\s*([\s\S]*?)Статистика по всем языкам/i)?.[1] ?? "";
  const languages = [...languageBlock.matchAll(/([^\[\]\r\n]+?)\s*-\s*(\d+)/g)].map((m) => ({ name: m[1].trim(), solved: Number(m[2]) })).filter((item) => item.name);
  const courseProgress = ["Язык программирования C++", "Решение олимпиадных задач", "Региональные олимпиады", "ЕГЭ по информатике", "Авторские задачи", "Тренировочные олимпиады"].map((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const value = text.match(new RegExp(`${escaped}\\s*[‒–—-]\\s*(\\d+)%`, "i"))?.[1];
    return { name, percent: value ? Number(value) : undefined };
  });
  const verdicts = { accepted: count(text, "Accepted"), wrongAnswer: count(text, "Wrong answer"), timeLimitExceeded: count(text, "Time limit exceeded"), presentationError: count(text, "Presentation Error"), compilationError: count(text, "Compilation error"), memoryLimitExceeded: count(text, "Memory limit exceeded"), runtimeError: count(text, "Runtime error") };
  const verdictValues = Object.values(verdicts).filter((value): value is number => typeof value === "number");
  const rawTitle = $("title").text().trim();
  const solvedProblems = problemList(general, "Решенные задачи");
  const [difficultyCatalog, topicCatalog] = await Promise.all([getDifficultyCatalog(), getTopicCatalog(solvedProblems)]);
  const mappedDifficulties = solvedProblems.flatMap((problemId) => {
    const problem = difficultyCatalog.get(problemId);
    return problem ? [{ id: problemId, ...problem }] : [];
  });
  const hardest = mappedDifficulties.reduce<(typeof mappedDifficulties)[number] | undefined>(
    (best, problem) => !best || problem.difficulty > best.difficulty ? problem : best,
    undefined,
  );
  const averageDifficulty = mappedDifficulties.length
    ? mappedDifficulties.reduce((sum, problem) => sum + problem.difficulty, 0) / mappedDifficulties.length
    : undefined;
  const difficultyBands = Array.from({ length: 20 }, (_, index) => ({ name: `${index * 5 + 1}–${index * 5 + 5}`, min: index * 5 + 1, max: index * 5 + 5 }));
  const topicProblems = new Map<string, { id: number; title: string; difficulty?: number; url: string }[]>();
  solvedProblems.forEach((problemId) => {
    const topic = topicCatalog.get(problemId);
    if (topic) {
      const metadata = difficultyCatalog.get(problemId);
      const problems = topicProblems.get(topic) ?? [];
      problems.push({ id: problemId, title: metadata?.title ?? `ACMP Problem ${problemId}`, difficulty: metadata?.difficulty, url: `https://acmp.ru/index.asp?main=task&id_task=${problemId}` });
      topicProblems.set(topic, problems);
    }
  });
  return {
    id, name: rawTitle.replace(/\s*[|—-]\s*(?:Школа программиста|ACMP).*$/i, "").trim() || `ACMP user ${id}`,
    sourceUrl: `https://acmp.ru/index.asp?main=user&id=${id}`,
    rank: rank && { place: rank[0], total: rank[1] }, rating: rating && { value: rating[0], maximum: rating[1] }, languages,
    solvedProblems, unsolvedProblems: problemList(general, "Нерешенные задачи"), courseProgress,
    lastVisit: text.match(/Последнее посещение\s*:\s*([^\r\n]+(?:\s+\d{1,2}:\d{2}:\d{2})?)/i)?.[1]?.trim(), verdicts,
    totalSubmissions: verdictValues.length ? verdictValues.reduce((sum, value) => sum + value, 0) : undefined,
    difficultyAnalysis: {
      average: averageDifficulty === undefined ? undefined : Math.round(averageDifficulty * 10) / 10,
      hardest: hardest && { ...hardest, url: `https://acmp.ru/index.asp?main=task&id_task=${hardest.id}` },
      mappedProblems: mappedDifficulties.length,
      totalSolved: solvedProblems.length,
      distribution: difficultyBands.map((band) => {
        const problems = mappedDifficulties
          .filter((problem) => problem.difficulty >= band.min && problem.difficulty <= band.max)
          .map((problem) => ({ ...problem, tag: topicCatalog.get(problem.id), url: `https://acmp.ru/index.asp?main=task&id_task=${problem.id}` }));
        return { name: band.name, count: problems.length, problems };
      }),
    },
    topicAnalysis: {
      stats: [...topicProblems].map(([name, problems]) => ({ name, count: problems.length, problems })).sort((a, b) => b.count - a.count),
      mappedProblems: solvedProblems.filter((id) => topicCatalog.has(id)).length,
      totalSolved: solvedProblems.length,
    },
  };
}
