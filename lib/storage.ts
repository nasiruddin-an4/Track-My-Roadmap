/*
 * Browser storage helpers. Progress is kept on the device first (so the page works
 * signed out and offline) and mirrored to the signed-in account.
 *
 * The keys "se-journey-v1" and "habit-tracker-v1" are the ones the original site used,
 * so progress already on a device carries over to the new site on the same domain.
 */
export const HABITS_KEY = "habit-tracker-v1";
export const UI_KEY = "tmr-ui";
export const OWNER_KEY = "tmr-owner";
const LEGACY_KEYS = ["se-journey-v1", HABITS_KEY, "se-journey-owner", "se-journey-ui-v3"];

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/** Remove every account's data from this browser (on sign-out, or when another account signs in). */
export function clearLocalData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i)!);
    keys.filter((k) => k.startsWith("tmr-") || LEGACY_KEYS.includes(k)).forEach((k) => localStorage.removeItem(k));
  } catch {}
}
