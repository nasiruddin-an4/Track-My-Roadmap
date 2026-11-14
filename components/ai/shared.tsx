/* Bits shared by the AI Tutor page and the links that open it. */

/** The AI Tutor page (the navbar and the home page's floating button link to it). */
export const AI_PAGE = "/ai";

/** The conversation, kept for this browser tab so leaving /ai and coming back doesn't lose it. */
export const CHAT_KEY = "tmr-ai-chat";

export const Sparkle = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5c.4 3.9 1.6 6.2 3.3 7.6 1.4 1.1 3.3 1.6 6.2 1.9-3 .3-4.9.9-6.3 2-1.6 1.4-2.8 3.7-3.2 7.5-.4-3.8-1.6-6.1-3.2-7.5-1.4-1.1-3.3-1.7-6.3-2 2.9-.3 4.8-.8 6.2-1.9C10.4 8.7 11.6 6.4 12 2.5Z" />
  </svg>
);
