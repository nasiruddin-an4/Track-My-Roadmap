/* Shared habit-tracker data (used by the tracker and the /habits overview). */

/** The routine a new tracker starts with; people can remove these and add their own. */
export const DEFAULT_HABITS: string[] = ["😴 Wake up (5:30–6:00 AM)", "💧 Drink 2 Glasses of Water", "🛏️ Make Bed", "🪥 Brush & Fresh Up", "🏋️ Stretching / Light Exercise", "🌄 Fajr Prayer", "🛁 Shower & Get Ready", "📚 Programming Study", "🥗 Breakfast & Leave for Office", "🌟 Dhuhr", "🌟 Asr Pray", "🌟 Maghrib Prayer", "🥗 Dinner", "💪 Programming / Build Projects", "📖 Read 10–15 pages", "🎯 Plan Tomorrow & Journal", "🌟 Isha Prayer", "😴 Sleep"];

/** Ideas shown while choosing habits. Names that match DEFAULT_HABITS exactly show as already chosen. */
const D = DEFAULT_HABITS;
export const HABIT_SUGGESTIONS: { group: string; items: string[] }[] = [
  { group: "Morning", items: [D[0], D[1], D[2], D[3], D[4], D[6], D[8]] },
  { group: "Learning & work", items: [D[7], D[13], D[14], "🧩 Solve 1 coding problem", "🗣️ Practice English 15 min", "📝 Write what I learned"] },
  { group: "Health", items: ["🚶 Walk 30 minutes", "📵 No phone for the first hour", "🍎 Eat fruit or vegetables", "🛌 Sleep by 11 PM"] },
  { group: "Faith", items: [D[5], D[9], D[10], D[11], D[16], "📿 Read Quran"] },
  { group: "Evening", items: [D[12], D[15], D[17]] },
];

export type HabitDoc = {
  habits: { id: string; name: string }[];
  /** "YYYY-MM" -> ["habitId:day", ...] */
  checks: Record<string, string[]>;
  notes: Record<string, { mood: Record<string, number>; motivation: Record<string, number> }>;
  updatedAt: number;
};

export const monthKey = (d: Date) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");

/** Today's ticks and the month so far, for a progress summary. */
export function habitSummary(doc: Pick<HabitDoc, "habits" | "checks">, now: Date) {
  const ticks = new Set(doc.checks[monthKey(now)] || []);
  const ids = new Set(doc.habits.map((h) => h.id));
  const day = now.getDate(), days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  let today = 0, month = 0;
  for (const t of ticks) {
    const [id, d] = t.split(":");
    if (!ids.has(id)) continue;
    month++;
    if (+d === day) today++;
  }
  const total = doc.habits.length;
  return { today, total, month, monthGoal: total * days, soFar: total * day };
}
