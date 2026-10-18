/**
 * Deterministic guardrail coverage tests.
 *
 * These do NOT call the LLM. They verify that for every evaluation
 * scenario, the system prompt assembled by buildSystemPrompt() contains
 * the relevant guardrail text. If a scenario's targeted rule is missing
 * from the prompt, the tutor has no instruction to follow — that's a
 * structural failure independent of the model.
 *
 * This also checks phase scoping: a scenario in the "analysis" phase
 * gets analysis-phase context, not investigation-phase context.
 */

import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  HARD_RULES_BLOCK,
  ROLE_BLOCK,
} from "../src/app/lib/build-system-prompt";
import type { ChatWithTutorInput } from "../src/app/lib/tutor-types";
import { loadSpec, CLASS_6_PATH, CLASS_8_PATH, CLASS_9_PATH, CLASS_10_PATH } from "./helpers";
import {
  SCENARIOS,
  violationProbes,
  falseBlockProbes,
  type HardRule,
  type GuardrailScenario,
} from "./guardrail-scenarios";

/* ------------------------------------------------------------------ */
/* Map lab_id → spec path                                              */
/* ------------------------------------------------------------------ */

const SPEC_PATHS: Record<string, string> = {
  "class-6-biology-habitat-explorer": CLASS_6_PATH,
  "class-8-physics-pressure": CLASS_8_PATH,
  "class-9-physics-motion": CLASS_9_PATH,
  "class-10-physics-electricity": CLASS_10_PATH,
};

function inputForScenario(scenario: GuardrailScenario, messages: ChatWithTutorInput["messages"] = []): ChatWithTutorInput {
  const base: ChatWithTutorInput = {
    lab_id: scenario.lab_id,
    current_phase: scenario.phase,
    messages,
    phase_responses: {},
  };
  if (scenario.prior_runs.length > 0) {
    base.investigation_summary = { completed_at: Date.now(), runs: scenario.prior_runs };
  }
  return base;
}

/* ------------------------------------------------------------------ */
/* Rule → text fragments that must be in the system prompt              */
/* ------------------------------------------------------------------ */

const RULE_FRAGMENTS: Record<HardRule, string[]> = {
  HR1_no_compute: [
    "NEVER compute a scientific result yourself",
    "compute a scientific result",
  ],
  HR2_no_fact: [
    "NEVER state a scientific fact as truth",
    "state a scientific fact as truth",
  ],
  HR3_no_confirm: [
    "do not confirm",
    "What does your data from the experiment show",
  ],
  HR4_redirect_ncl: [
    "refer them to the New Content Learning section",
  ],
  HR5_socratic: [
    "Socratic method",
    "ask one question that narrows their thinking",
  ],
};

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("guardrail coverage — system prompt contains targeted rules", () => {
  for (const scenario of violationProbes()) {
    it(`${scenario.id}: prompt includes ${scenario.targeted_rule} text`, () => {
      const specPath = SPEC_PATHS[scenario.lab_id];
      expect(specPath, `unknown lab_id: ${scenario.lab_id}`).toBeDefined();

      const spec = loadSpec(specPath!);
      const input = inputForScenario(scenario, [{ role: "user", content: scenario.student_message }]);
      const prompt = buildSystemPrompt(spec, input);

      const fragments = RULE_FRAGMENTS[scenario.targeted_rule as HardRule];
      expect(fragments, `no fragments for ${scenario.targeted_rule}`).toBeDefined();
      for (const frag of fragments!) {
        expect(prompt).toContain(frag);
      }
    });
  }
});

describe("guardrail coverage — HARD_RULES_BLOCK always present", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.id}: prompt starts with role + hard rules`, () => {
      const specPath = SPEC_PATHS[scenario.lab_id];
      const spec = loadSpec(specPath!);
      const input = inputForScenario(scenario);
      const prompt = buildSystemPrompt(spec, input);

      expect(prompt).toContain(ROLE_BLOCK);
      expect(prompt).toContain(HARD_RULES_BLOCK);
    });
  }
});

describe("guardrail coverage — phase scoping", () => {
  const PHASE_MARKERS: Record<string, string> = {
    provocation: "PHASE: Provocation",
    ncl: "PHASE: New Content Learning",
    investigation: "PHASE: Investigation",
    analysis: "PHASE: Analysis",
    discussion: "PHASE: Discussion",
    reflection: "PHASE: Reflection",
  };

  for (const scenario of SCENARIOS) {
    it(`${scenario.id}: prompt includes ${scenario.phase} phase marker`, () => {
      const specPath = SPEC_PATHS[scenario.lab_id];
      const spec = loadSpec(specPath!);
      const input = inputForScenario(scenario);
      const prompt = buildSystemPrompt(spec, input);
      expect(prompt).toContain(PHASE_MARKERS[scenario.phase]);
    });
  }
});

describe("guardrail coverage — false-block probes get helpful context", () => {
  for (const scenario of falseBlockProbes()) {
    it(`${scenario.id}: prompt includes allowed actions`, () => {
      const specPath = SPEC_PATHS[scenario.lab_id];
      const spec = loadSpec(specPath!);
      const input = inputForScenario(scenario, [{ role: "user", content: scenario.student_message }]);
      const prompt = buildSystemPrompt(spec, input);
      expect(prompt).toContain("You may:");
      expect(prompt).toContain("hint");
      expect(prompt).toContain("encourage");
    });
  }
});

describe("guardrail coverage — scenario bank completeness", () => {
  it("covers all 5 hard rules with at least 2 violation probes each", () => {
    const rules: HardRule[] = [
      "HR1_no_compute", "HR2_no_fact", "HR3_no_confirm",
      "HR4_redirect_ncl", "HR5_socratic",
    ];
    for (const rule of rules) {
      const count = violationProbes().filter((s) => s.targeted_rule === rule).length;
      expect(count, `${rule} needs ≥2 probes, has ${count}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("has at least 6 false-block probes", () => {
    expect(falseBlockProbes().length).toBeGreaterThanOrEqual(6);
  });

  it("covers at least 3 different labs", () => {
    const labs = new Set(SCENARIOS.map((s) => s.lab_id));
    expect(labs.size).toBeGreaterThanOrEqual(3);
  });

  it("covers at least 4 different phases", () => {
    const phases = new Set(SCENARIOS.map((s) => s.phase));
    expect(phases.size).toBeGreaterThanOrEqual(4);
  });
});
