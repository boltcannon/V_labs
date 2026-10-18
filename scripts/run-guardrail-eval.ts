/**
 * Guardrail evaluation runner.
 *
 * Calls the real Groq API for each scenario in the scenario bank and
 * writes structured JSON for human labelling.
 *
 * Usage:
 *   npx tsx scripts/run-guardrail-eval.ts
 *
 * Requires GROQ_API_KEY in .env.local (loaded via dotenv).
 *
 * Output: scripts/guardrail-eval-results.json
 *   — one entry per scenario with the raw tutor response
 *   — human adds labels (see label fields) and runs compute-metrics
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as dotenv from "dotenv";
import OpenAI from "openai";

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

// Import scenario bank and prompt builder
import { SCENARIOS, type GuardrailScenario } from "../tests/guardrail-scenarios";
import { buildSystemPrompt } from "../src/app/lib/build-system-prompt";
import { TUTOR_MODEL, MAX_TOKENS } from "../src/app/lib/tutor-constants";
import type { ChatWithTutorInput } from "../src/app/lib/tutor-types";

// Dynamic import to load specs (they use path aliases)
import { loadSpec } from "../tests/helpers";

const SPEC_PATHS: Record<string, string> = {
  "class-6-biology-habitat-explorer": path.resolve(__dirname, "../src/specs/class-6-biology-habitat-explorer.yaml"),
  "class-8-physics-pressure": path.resolve(__dirname, "../src/specs/class-8-physics-pressure.yaml"),
  "class-9-physics-motion": path.resolve(__dirname, "../src/specs/class-9-physics-motion.yaml"),
  "class-10-physics-electricity": path.resolve(__dirname, "../src/specs/class-10-physics-electricity.yaml"),
};

export interface EvalResult {
  scenario_id: string;
  probe_kind: "violation" | "false_block";
  targeted_rule: string;
  student_message: string;
  lab_id: string;
  phase: string;
  expected_behaviour: string;
  raw_tutor_response: string;
  api_error?: string;
  // Human labels — filled by the labeller:
  label_violation?: boolean;     // Did the tutor violate the targeted rule?
  label_fallback?: boolean;      // Did the tutor use a generic fallback instead of engaging?
  label_false_block?: boolean;   // Did the tutor refuse a legitimate question?
  label_miss?: boolean;          // Did the tutor miss a guardrail-relevant situation?
  label_notes?: string;          // Free-text notes from the labeller
}

async function runEval(): Promise<void> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("ERROR: GROQ_API_KEY not found in .env.local");
    process.exit(1);
  }

  const client = new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });

  const results: EvalResult[] = [];
  const total = SCENARIOS.length;

  for (let i = 0; i < total; i++) {
    const scenario = SCENARIOS[i]!;
    console.log(`[${i + 1}/${total}] ${scenario.id} ...`);

    const specPath = SPEC_PATHS[scenario.lab_id];
    if (!specPath) {
      results.push({
        ...baseResult(scenario),
        raw_tutor_response: "",
        api_error: `Unknown lab_id: ${scenario.lab_id}`,
      });
      continue;
    }

    const spec = loadSpec(specPath);
    const input: ChatWithTutorInput = {
      lab_id: scenario.lab_id,
      current_phase: scenario.phase,
      messages: [{ role: "user", content: scenario.student_message }],
      phase_responses: {},
      investigation_summary:
        scenario.prior_runs.length > 0
          ? { completed_at: Date.now(), runs: scenario.prior_runs }
          : undefined,
    };

    const systemPrompt = buildSystemPrompt(spec, input);

    try {
      const response = await client.chat.completions.create({
        model: TUTOR_MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: scenario.student_message },
        ],
      });

      const reply = response.choices[0]?.message?.content ?? "";
      results.push({
        ...baseResult(scenario),
        raw_tutor_response: reply,
      });
      console.log(`  → ${reply.slice(0, 80)}...`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        ...baseResult(scenario),
        raw_tutor_response: "",
        api_error: msg,
      });
      console.error(`  → ERROR: ${msg}`);
    }

    // Rate limit: 100ms between calls
    await new Promise((r) => setTimeout(r, 100));
  }

  const outPath = path.resolve(__dirname, "guardrail-eval-results.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nDone. ${results.length} results written to ${outPath}`);
  console.log("Next: open the file, fill in label_* fields, then run compute-guardrail-metrics.ts");
}

function baseResult(s: GuardrailScenario): Omit<EvalResult, "raw_tutor_response"> {
  return {
    scenario_id: s.id,
    probe_kind: s.probe_kind,
    targeted_rule: s.targeted_rule,
    student_message: s.student_message,
    lab_id: s.lab_id,
    phase: s.phase,
    expected_behaviour: s.expected_behaviour,
  };
}

runEval().catch((err) => {
  console.error(err);
  process.exit(1);
});
