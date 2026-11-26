import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import Groq from "groq-sdk";
import { activeProvider, BusyError } from "@/lib/assistant/providers";
import { cleanExplanation, EXPLAIN_SYSTEM, explainPrompt, type TopicContext } from "@/lib/explainText";
import { getServiceSupabase } from "@/lib/supabase/service";

/*
 * "What is this?" for roadmap topics. The first learner to ask about a topic gets an explanation written by the AI
 * (the same provider as the AI Tutor: Groq when GROQ_API_KEY is set, otherwise Claude); it's saved in the
 * topic_explanations table, and everyone after that gets the saved copy. So each topic costs one AI call ever.
 * Without SUPABASE_SECRET_KEY the copies are only kept in this server instance's memory.
 */

export const explainConfigured = () => activeProvider() !== null;

const memory = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
const id = (slug: string, key: string) => `${slug}|${key}`;

export async function savedExplanation(slug: string, key: string): Promise<string | null> {
  const sb = getServiceSupabase();
  if (sb) {
    const { data, error } = await sb.from("topic_explanations").select("body").eq("roadmap", slug).eq("topic_key", key).maybeSingle();
    if (!error && data?.body) return String(data.body);
    if (error && error.code !== "PGRST116") console.error("topic_explanations read:", error.message);
  }
  return memory.get(id(slug, key)) ?? null;
}

async function save(slug: string, key: string, body: string) {
  if (memory.size > 2000) memory.clear();
  memory.set(id(slug, key), body);
  const sb = getServiceSupabase();
  if (!sb) return;
  const { error } = await sb.from("topic_explanations").upsert({ roadmap: slug, topic_key: key, body });
  // the table may not exist yet (supabase/schema.sql not re-run): the explanation still works, it's just not shared
  if (error) console.error("topic_explanations write:", error.message);
}

let groq: Groq | null = null;
let anthropic: Anthropic | null = null;

async function ask(prompt: string): Promise<string> {
  const provider = activeProvider();
  if (provider === "groq") {
    groq ??= new Groq({ maxRetries: 0, timeout: 30_000 });
    try {
      const r = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: EXPLAIN_SYSTEM }, { role: "user", content: prompt }],
        reasoning_effort: "low",
        include_reasoning: false,
        temperature: 0.4,
        max_completion_tokens: 800,
      });
      return r.choices[0]?.message?.content ?? "";
    } catch (e) {
      if (e instanceof Groq.RateLimitError) throw new BusyError("groq rate limit");
      throw e;
    }
  }
  if (provider === "claude") {
    anthropic ??= new Anthropic({ maxRetries: 1, timeout: 60_000 });
    try {
      const r = await anthropic.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 4000,
        output_config: { effort: "low" },
        // if the model declines on a false positive, the API retries on its default fallback model in the same call
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: EXPLAIN_SYSTEM,
        messages: [{ role: "user", content: prompt }],
      });
      if (r.stop_reason === "refusal") return "";
      return r.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new BusyError("claude rate limit");
      throw e;
    }
  }
  throw new Error("no AI provider");
}

/** Write, save and return the explanation of a topic. Two learners asking at once share one AI call. */
export function writeExplanation(slug: string, key: string, t: TopicContext): Promise<string> {
  const k = id(slug, key);
  const running = inFlight.get(k);
  if (running) return running;
  const job = (async () => {
    const body = cleanExplanation(await ask(explainPrompt(t)));
    if (body.length < 20) throw new Error("empty explanation");
    await save(slug, key, body);
    return body;
  })().finally(() => inFlight.delete(k));
  inFlight.set(k, job);
  return job;
}
