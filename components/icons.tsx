import Image from "next/image";

type P = { size?: number; className?: string };
const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const Check = ({ size = 12, className }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={3.4} className={className} {...base}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const Loop = ({ size = 14 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.4} {...base}><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 0 1 4-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 0 1-4 4H4" /></svg>
);
export const Search = ({ size = 17 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2} {...base}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const Close = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const Dots = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
);
export const Chevron = ({ dir = "right", size = 18 }: P & { dir?: "left" | "right" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} {...base}><path d={dir === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} /></svg>
);
export const Arrow = ({ size = 16 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={2.2} {...base}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const Google = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
);

/** The app icon (orange rounded square with the road and flag). */
export const Logo = ({ size = 30, className }: P) => (
  <Image src="/brand/icon-128.png" alt="" width={size} height={size} className={className} priority />
);

/** The full logo: icon plus "Track My Roadmap" wordmark (504×144 source, shown at the given height).
 *  `onDark` uses the version with white "Track My" text. */
export const Wordmark = ({ height = 40, className, onDark }: { height?: number; className?: string; onDark?: boolean }) => (
  <Image src={onDark ? "/brand/logo-on-dark.png" : "/brand/logo.png"} alt="Track My Roadmap" width={Math.round((504 / 144) * height)} height={height} className={className} priority />
);
