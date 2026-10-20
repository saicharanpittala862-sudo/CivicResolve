/** Rule-based smart routing. Swap `suggest` for an ML model later; the interface stays the same. */
export type Priority = "low" | "medium" | "high" | "critical";
export const PRIORITIES: readonly Priority[] = ["low", "medium", "high", "critical"];

const KEYWORDS: Record<string, string[]> = {
  "Pothole Repair": ["pothole", "crater", "road", "asphalt", "tar"],
  "Street Lighting Outage": ["streetlight", "street light", "lamp", "dark", "light"],
  "Drainage & Flooding": ["drain", "drainage", "flood", "waterlogging", "stormwater"],
  "Footpath & Signage": ["footpath", "pavement", "sign", "signal", "zebra"],
  "Water Supply Disruption": ["no water", "water supply", "tap", "pipeline", "pipe", "leak"],
  "Sewerage Overflow": ["sewage", "sewer", "manhole", "overflow"],
  "Waste Collection": ["garbage", "waste", "dustbin", "trash", "litter"],
  "Water Quality": ["contaminated", "dirty water", "muddy", "smell", "quality"],
  "Public Safety": ["unsafe", "theft", "harass", "fire", "accident", "safety"],
  "Parks & Open Spaces": ["park", "playground", "garden", "bench", "tree"],
  "Facilities & Buildings": ["building", "toilet", "restroom", "lift", "classroom", "hall", "facility"],
  "Noise & Nuisance": ["noise", "loud", "music", "nuisance", "stray"],
};
const CRITICAL = ["burst", "live wire", "sparking", "fire", "collapsed", "accident", "electrocut", "injur"];
const HIGH = ["no water", "overflow", "outbreak", "hospital", "blocked", "days", "flood", "unsafe"];

export interface Suggestion { categoryName: string | null; priority: Priority; confidence: number }

export function suggest(text: string): Suggestion {
  const t = text.toLowerCase();
  let best: string | null = null, score = 0;
  for (const [name, words] of Object.entries(KEYWORDS)) {
    const s = words.filter((w) => t.includes(w)).length;
    if (s > score) { best = name; score = s; }
  }
  let priority: Priority = "medium";
  if (HIGH.some((k) => t.includes(k))) priority = "high";
  if (CRITICAL.some((k) => t.includes(k))) priority = "critical";
  return { categoryName: best, priority, confidence: score ? Math.min(0.95, 0.5 + 0.15 * score) : 0 };
}

const tokens = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
export function similarity(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  const union = new Set([...x, ...y]).size;
  return union ? [...x].filter((w) => y.has(w)).length / union : 0;
}
