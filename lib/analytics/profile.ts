export type SkillLevel = "Beginner" | "Developing" | "Strong" | "Advanced";

export interface TopicMetric { name: string; count: number; share: number }
export interface SkillMetric { name: string; solved: number; level: SkillLevel; topics: string[] }

const groups: Record<string, string[]> = {
  Algorithms: ["greedy", "binary search", "two pointers", "sortings", "sorting"],
  "Data Structures": ["dsu", "trees", "hashing", "data structures", "segment tree", "arrays"],
  "Dynamic Programming": ["dp", "dynamic programming"],
  Graphs: ["dfs", "graphs", "shortest paths", "flows", "graph matchings", "matching"],
  Mathematics: ["math", "mathematics", "number theory", "combinatorics", "geometry", "crt", "probabilities"],
  Implementation: ["implementation", "strings", "constructive", "constructive algorithms", "brute force"],
};

const norm = (value: string) => value.trim().toLowerCase();

export function topicMetrics(stats: { name: string; count: number }[], totalSolved: number): TopicMetric[] {
  return stats.map((item) => ({ ...item, share: totalSolved ? item.count / totalSolved * 100 : 0 }));
}

export function skillLevel(count: number, totalSolved: number): SkillLevel {
  const share = totalSolved ? count / totalSolved : 0;
  if (count >= 60 || (count >= 30 && share >= .12)) return "Advanced";
  if (count >= 25 || (count >= 12 && share >= .07)) return "Strong";
  if (count >= 8 || share >= .035) return "Developing";
  return "Beginner";
}

export function skillMap(stats: { name: string; count: number }[], totalSolved: number): SkillMetric[] {
  const lookup = new Map(stats.map((item) => [norm(item.name), item.count]));
  return Object.entries(groups).map(([name, topics]) => {
    const solved = topics.reduce((sum, topic) => sum + (lookup.get(topic) ?? 0), 0);
    return { name, solved, level: skillLevel(solved, totalSolved), topics };
  });
}

export function strongestAreas(stats: { name: string; count: number }[], limit = 3) {
  return [...stats].filter((item) => item.count > 0).sort((a,b) => b.count-a.count).slice(0, limit);
}

export function improvementAreas(stats: { name: string; count: number }[], totalSolved: number, limit = 4) {
  if (!stats.length || totalSolved < 20) return [];
  const meaningful = stats.filter((item) => item.count > 0);
  const median = [...meaningful].sort((a,b)=>a.count-b.count)[Math.floor(meaningful.length/2)]?.count ?? 0;
  const threshold = Math.max(2, Math.min(median, Math.ceil(totalSolved * .025)));
  return meaningful.filter((item) => item.count <= threshold).sort((a,b)=>a.count-b.count).slice(0, limit);
}

export function recommendations(stats: { name: string; count: number }[], totalSolved: number) {
  const strong = strongestAreas(stats, 2);
  return improvementAreas(stats, totalSolved, 3).map((topic) => {
    const target = Math.max(topic.count + 8, Math.ceil(topic.count / 10) * 10 + 10);
    return {
      topic: topic.name,
      current: topic.count,
      level: skillLevel(topic.count, totalSolved),
      target,
      reason: strong.length
        ? `Your foundation in ${strong.map((item)=>item.name).join(" and ")} is stronger. Building ${topic.name} next can broaden the kinds of olympiad problems you can approach.`
        : `Build more experience in ${topic.name} to improve topic coverage and problem-solving range.`,
    };
  });
}
