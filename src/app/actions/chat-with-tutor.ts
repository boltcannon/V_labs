"use server";

/**
 * AI tutor Server Action.
 *
 * Flow, in strict order (each guard is CHEAPER than the next):
 *   1. Message-count ceiling — refuse conversations longer than 20 turns
 *      BEFORE loading anything else, so a runaway client cannot spend
 *      API quota.
 *   2. Lab-id check — refuse if the client's `lab_id` is not a known spec.
 *   3. Load the ValidatedLabSpec (React.cache-deduped + module-cached).
 *   4. `buildSystemPrompt` — pure, unit-tested. This is the file whose
 *      test suite enforces principle 8: no rule expression, no
 *      decision-table row, no rule description ever appears in the
 *      string the tutor sees.
 *   5. Call the chat-completions API with `max_tokens: 512` (intentional
 *      cognitive-load ceiling — a tutor writing three paragraphs while
 *      the student is mid-experiment is a load problem, not a feature).
 *
 * PROVIDER: Groq (Checkpoint 3, at Umang's direction — no Anthropic key
 * was available). Groq exposes an OpenAI-compatible REST surface, so this
 * file uses the `openai` SDK pointed at Groq's base URL rather than
 * `@anthropic-ai/sdk`. `buildSystemPrompt` and the `TutorMessage` /
 * `ChatWithTutorInput` types are unchanged — they were always
 * provider-agnostic. Swapping providers again later means changing only
 * this file's client construction and response parsing below.
 *
 * The API key lives only in GROQ_API_KEY env — never on the client, never
 * in a prop, never in a serialised RSC payload.
 */

import OpenAI from "openai";

import { getLabSpec, labExists } from "@/app/lib/get-lab-spec";
import { buildSystemPrompt } from "@/app/lib/build-system-prompt";
import type { ChatWithTutorInput } from "@/app/lib/tutor-types";
import { MAX_TOKENS, MAX_TURNS, TUTOR_MODEL } from "@/app/lib/tutor-constants";

interface ChatWithTutorOutput {
  reply: string;
  error?: string;
}

export async function chatWithTutor(
  input: ChatWithTutorInput,
): Promise<ChatWithTutorOutput> {
  // 1. Cheapest guard first: message-count ceiling. Prevents runaway
  //    conversations from spending API quota.
  if (input.messages.length > MAX_TURNS) {
    return {
      reply: "",
      error:
        "Long conversation — try moving forward and revisiting if needed.",
    };
  }

  // 2. Lab-id provenance: refuse if the lab_id is not a known spec.
  if (!labExists(input.lab_id)) {
    return { reply: "", error: `Unknown lab '${input.lab_id}'.` };
  }

  // 3. Load spec + assemble system prompt. Both are server-only.
  const spec = getLabSpec(input.lab_id);
  const systemPrompt = buildSystemPrompt(spec, input);

  // 4. Groq API call (OpenAI-compatible chat-completions shape). The
  //    system prompt is the first message, not a separate top-level
  //    param — that's the one structural difference from the Anthropic
  //    call this replaced.
  try {
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
    const response = await client.chat.completions.create({
      model: TUTOR_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        ...input.messages,
      ],
    });
    const reply = response.choices[0]?.message?.content ?? "";
    return { reply };
  } catch (err) {
    return {
      reply: "",
      error:
        err instanceof Error ? err.message : "Tutor is temporarily unavailable.",
    };
  }
}
