import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { SYSTEM_PROMPT, SYSTEM_PROMPT_COMPACT } from "@/lib/assistant/prompt";

/*
 * The AI Tutor can run on Groq or on Claude, picked by which key is set (Groq first, so its free tier can be used
 * while trying things out). Each provider streams plain reply text; the route doesn't care which one it got.
 *   GROQ_API_KEY       Groq, model openai/gpt-oss-120b. Gets the compact catalogue: Groq's free tier allows only
 *                      about 8K tokens a minute for this model, shared by every visitor.
 *   ANTHROPIC_API_KEY  Claude Opus 5.5, with the full catalogue (prompt-cached).
 */

export type Turn = { role: "user" | "assistant"; content: string };
export type Provider = "groq" | "claude";

export function activeProvider(): Provider | null {
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

/** The provider is at its rate limit; the reply should say "try again in a minute". */
export class BusyError extends Error {}

let groq: Groq | null = null;
let anthropic: Anthropic | null = null;

/** Reply text as it streams. `learner` is the per-request progress note. */
export async function* streamReply(provider: Provider, learner: string, messages: Turn[], signal: AbortSignal): AsyncGenerator<string> {
  if (provider === "groq") {
    // no silent retries: at the rate limit the SDK would wait 20s+ before answering, so say "busy" straight away
    groq ??= new Groq({ maxRetries: 0, timeout: 30_000 });
    let stream;
    try {
      stream = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: `${SYSTEM_PROMPT_COMPACT}\n\n${learner}` }, ...messages],
        reasoning_effort: "low",
        include_reasoning: false, // keep the model's reasoning out of the reply
        temperature: 0.5,
        max_completion_tokens: 1024,
        stream: true,
      }, { signal });
    } catch (e) {
      if (e instanceof Groq.RateLimitError) throw new BusyError("groq rate limit");
      throw e;
    }
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
    return;
  }

  anthropic ??= new Anthropic();
  const stream = anthropic.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "low" },
    // if the model declines on a false positive, the API retries on its default fallback model in the same call
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: learner },
    ],
    messages,
  }, { signal });
  try {
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
    }
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new BusyError("claude rate limit");
    throw e;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") yield "\n\nSorry, I can’t help with that one. Ask me about a career or skill you’d like to learn.";
}

/** A short, safe description of a provider error for the server log (never the key). */
export function describeError(e: unknown): string {
  if (e instanceof Anthropic.APIError) return `claude ${e.status} ${e.message}`;
  if (e instanceof Groq.APIError) return `groq ${e.status} ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
