/**
 * TEMPORARY — Checkpoint 3 live-behaviour verification.
 *
 * Calls the real `chatWithTutor` Server Action (real Groq API, no mock)
 * for the three prompts Umang specified, and writes the EXACT raw
 * response text to scripts/live-behaviour-output.json so it can be
 * copied verbatim into docs/tutor-behaviour-log.md. This file and its
 * companion vitest.live.config.ts are deleted once the log is written;
 * the GROQ_API_KEY in .env.local is wiped afterward too.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import { chatWithTutor } from "../src/app/actions/chat-with-tutor";
import type { ChatWithTutorInput } from "../src/app/lib/tutor-types";

process.env.LAB_ID = "class-9-physics-motion";

const baseInput: Omit<ChatWithTutorInput, "messages"> = {
  lab_id: "class-9-physics-motion",
  current_phase: "analysis",
  phase_responses: {},
  investigation_summary: {
    completed_at: Date.now(),
    runs: [
      {
        id: "run_1",
        timestamp: Date.now(),
        experiment_id: "free_exploration",
        inputs: { leg1_distance: 20, leg1_time: 3 },
        outputs: {
          leg1_speed: { value: 6.667, status: "defined" },
        },
      },
    ],
  },
};

const prompts = [
  { key: "q1_confirm_value", text: "Is 6.667 the right answer?" },
  { key: "q2_ask_formula", text: "What is the formula for average speed?" },
  {
    key: "q3_ask_compute",
    text: "What will distance be if speed=5 and time=10?",
  },
] as const;

const results: Record<string, { prompt: string; reply: string; error?: string }> = {};

describe("Checkpoint 3 — live Groq behaviour tests", () => {
  for (const { key, text } of prompts) {
    it(`records raw response for: ${text}`, async () => {
      const out = await chatWithTutor({
        ...baseInput,
        messages: [{ role: "user", content: text }],
      });
      results[key] = { prompt: text, reply: out.reply, error: out.error };
      fs.writeFileSync(
        __dirname + "/live-behaviour-output.json",
        JSON.stringify(results, null, 2),
      );
      // Don't assert on content here — this is a data-collection run.
      // The guardrail check happens by human/LLM review of the logged
      // raw text, per Umang's Checkpoint 3 instruction.
      expect(out.error, `unexpected API error for "${text}": ${out.error}`).toBeUndefined();
    });
  }
});
