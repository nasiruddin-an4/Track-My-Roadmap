/**
 * Where to send someone after sign-in, from a `?next=` value. Only paths on this site are allowed:
 * the value is resolved like a browser would (so "/\evil.com" or "/<tab>/evil.com", which browsers read
 * as "//evil.com", are caught) and rejected unless it stays on the same origin.
 */
export function safeNext(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/")) return fallback;
  try {
    const base = "https://same-origin.invalid";
    const u = new URL(raw, base);
    return u.origin === base ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}
