import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

/*
 * Claude for the CV Builder: reading uploaded CVs, reading keywords from job descriptions, and rewriting
 * bullets and summaries. Every call returns JSON in a fixed shape (structured outputs), checked with zod.
 *   ANTHROPIC_API_KEY  the Claude API key
 *   CV_AI_MODEL        which Claude model to use (e.g. claude-opus-5-5)
 * Nothing the person wrote is logged.
 */

export const cvAiConfigured = () => !!(process.env.ANTHROPIC_API_KEY && process.env.CV_AI_MODEL);

/** "busy": rate limited, try later. "refused": the model declined. "invalid": no usable answer after a retry. */
export class CvAiError extends Error {
  constructor(public reason: "busy" | "refused" | "invalid") { super(reason); }
}

let client: Anthropic | null = null;

/**
 * Ask for JSON matching `schema`. `accept` can check or tidy the answer further; returning null counts as a bad
 * answer. One retry on a bad answer.
 */
export async function askStructured<S extends z.ZodType, R>(
  schema: S, system: string, user: string, accept: (out: z.infer<S>) => R | null, maxTokens = 16000,
): Promise<R> {
  client ??= new Anthropic({ maxRetries: 1, timeout: 90_000 });
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await client.beta.messages.parse({
        model: process.env.CV_AI_MODEL!,
        max_tokens: maxTokens,
        output_config: { effort: "low", format: betaZodOutputFormat(schema) },
        // if the model declines on a false positive, the API retries on its default fallback model in the same call
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: user }],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new CvAiError("busy");
      throw e;
    }
    if (res.stop_reason === "refusal") throw new CvAiError("refused");
    if (res.stop_reason === "max_tokens" || !res.parsed_output) continue;
    const ok = accept(res.parsed_output as z.infer<S>);
    if (ok !== null) return ok;
  }
  throw new CvAiError("invalid");
}

/** A friendly reply for an AI failure. */
export function aiErrorReply(e: unknown, what: string): { status: number; error: string } {
  if (e instanceof CvAiError && e.reason === "busy") return { status: 503, error: "Our AI is busy right now. Please try again in a minute." };
  if (e instanceof CvAiError && e.reason === "refused") return { status: 422, error: `We couldn’t ${what} for that text. Please check it and try again.` };
  return { status: 502, error: `We couldn’t ${what} just now. Please try again.` };
}
