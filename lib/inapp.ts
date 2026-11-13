/*
 * Google blocks sign-in inside apps' built-in browsers (Messenger, Facebook, Instagram,
 * LinkedIn…) with "This browser or app may not be secure". We detect them and send
 * people to Chrome or Safari instead.
 */
export type InApp = { inApp: boolean; android: boolean; ios: boolean; chromeUrl: string; safariUrl: string; pageUrl: string };

export function detectInApp(): InApp {
  const ua = navigator.userAgent || "";
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  const inApp =
    /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|LinkedInApp|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|Twitter|; wv\)/i.test(ua) ||
    (ios && !/Safari\//.test(ua) && !standalone); // iOS app web views have no "Safari/" token
  const pageUrl = location.origin + location.pathname + location.search;
  return {
    inApp, android, ios, pageUrl,
    chromeUrl: "intent://" + location.host + location.pathname + location.search + "#Intent;scheme=https;package=com.android.chrome;end",
    safariUrl: "x-safari-" + pageUrl, // iOS 17+
  };
}

/** Try once per visit to jump straight to the real browser. */
export function escapeInAppOnce() {
  const env = detectInApp();
  if (!env.inApp) return;
  try {
    if (sessionStorage.getItem("tmr-escape") === "1") return;
    sessionStorage.setItem("tmr-escape", "1");
  } catch {
    return;
  }
  if (env.android) location.href = env.chromeUrl;
  else if (env.ios) location.href = env.safariUrl;
}
