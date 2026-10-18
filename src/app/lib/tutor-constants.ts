/**
 * Tutor Server-Action constants. Kept in a separate file because a
 * "use server" file may only export async functions, but the tests and
 * the client also need these values.
 */

export const MAX_TURNS = 20;
/**
 * Provider swap (Checkpoint 3, at Umang's direction): Groq's free tier
 * instead of the Anthropic API, because no Anthropic key was available.
 * Groq exposes an OpenAI-compatible chat-completions endpoint — see
 * `chat-with-tutor.ts` for the client wiring. GPT-OSS 120B is Groq's
 * strongest free Developer-tier model (Llama 3.3 70B moved to
 * Enterprise-only as of mid-2026).
 */
export const TUTOR_MODEL = "openai/gpt-oss-120b";
export const MAX_TOKENS = 512;
