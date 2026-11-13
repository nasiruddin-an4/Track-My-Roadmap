/* Shared habit-tracker data (used by the tracker and the /habits overview). */

/** The routine a new tracker starts with; people can remove these and add their own. */
export const DEFAULT_HABITS: string[] = ["😴 Wake up (5:30–6:00 AM)", "💧 Drink 2 Glasses of Water", "🛏️ Make Bed", "🪥 Brush & Fresh Up", "🏋️ Stretching / Light Exercise", "🌄 Fajr Prayer", "🛁 Shower & Get Ready", "📚 Programming Study", "🥗 Breakfast & Leave for Office", "🌟 Dhuhr", "🌟 Asr Pray", "🌟 Maghrib Prayer", "🥗 Dinner", "💪 Programming / Build Projects", "📖 Read 10–15 pages", "🎯 Plan Tomorrow & Journal", "🌟 Isha Prayer", "😴 Sleep"];

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
