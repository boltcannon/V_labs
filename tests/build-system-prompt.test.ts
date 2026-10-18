import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  HARD_RULES_BLOCK,
  ROLE_BLOCK,
} from "../src/app/lib/build-system-prompt";
import type { ChatWithTutorInput } from "../src/app/lib/tutor-types";
import type { InvestigationSummary } from "../src/app/lib/experiment-run";
import type { PhaseId } from "../src/app/lib/session-shared";
import { loadSpec, CLASS_6_PATH, CLASS_9_PATH, CLASS_10_PATH } from "./helpers";

/**
 * These tests are the architectural enforcement of Principle 8. If they
 * pass, the system prompt sent to Anthropic cannot leak the deterministic
 * rules that the AI is forbidden from asserting on its own.
 *
 * Assertions are per-rule and per-decision-table-row, iterating over the
 * loaded spec — NOT against a hand-crafted allowlist — so any future rule
 * added to any spec is automatically covered.
 */

function baseInput(phase: PhaseId): ChatWithTutorInput {
  return {
    lab_id: "class-9-physics-motion",
    current_phase: phase,
    messages: [],
    phase_responses: {},
  };
}

const SPECS = [
  { name: "class-9", path: CLASS_9_PATH },
  { name: "class-6", path: CLASS_6_PATH },
  { name: "class-10", path: CLASS_10_PATH },
];

/* ------------------------------------------------------------------ */
/* Load-bearing negative assertions — Principle 8 enforcement          */
/* ------------------------------------------------------------------ */

for (const { name, path } of SPECS) {
  describe(`build-system-prompt / principle 8 leakage — ${name}`, () => {
    const spec = loadSpec(path);

    it("system prompt never contains any rule's `expression` string, on any phase", () => {
      const phases: PhaseId[] = [
        "provocation", "ncl", "investigation", "analysis",
        "discussion", "reflection",
      ];
      const rulesWithExpressions = spec.science_model.rules.filter(
        (r) => typeof r.expression === "string" && r.expression.length > 0,
      );
      // Conditional sanity: some specs (e.g. Class 6) are entirely
      // decision-table-based and have zero expression rules. In that case
      // there is nothing to leak, and the per-rule loop below is a no-op.
      for (const phase of phases) {
        const prompt = buildSystemPrompt(spec, baseInput(phase));
        for (const rule of rulesWithExpressions) {
          expect(prompt, `[phase=${phase}] expression from rule '${rule.id}' leaked`)
            .not.toContain(rule.expression!);
        }
      }
    });

    it("system prompt never contains any rule's `description` string", () => {
      // Rule descriptions narrate the science ("distance covered equals speed
      // times time") — including one is tantamount to stating the formula.
      const phases: PhaseId[] = [
        "provocation", "ncl", "investigation", "analysis",
        "discussion", "reflection",
      ];
      for (const phase of phases) {
        const prompt = buildSystemPrompt(spec, baseInput(phase));
        for (const rule of spec.science_model.rules) {
          expect(prompt, `[phase=${phase}] description from rule '${rule.id}' leaked`)
            .not.toContain(rule.description);
        }
      }
    });

    it("system prompt never contains a decision-table row's `when` clause (serialised)", () => {
      // A leaked ROW — the mapping from inputs to output — is what
      // reveals the rule. A single categorical output value (e.g. the
      // word 'uniform') is not a rule leak, because those words also
      // appear legitimately in data-interpretation prompts. So the check
      // targets the row's `when` clause and its full serialisation, not
      // its `then` value alone.
      const phases: PhaseId[] = [
        "provocation", "ncl", "investigation", "analysis",
        "discussion", "reflection",
      ];
      const tables = spec.science_model.decision_tables ?? [];
      for (const phase of phases) {
        const prompt = buildSystemPrompt(spec, baseInput(phase));
        for (const table of tables) {
          for (const row of table.rows) {
            expect(prompt, `[phase=${phase}] serialised row from '${table.id}' leaked`)
              .not.toContain(JSON.stringify(row));
            expect(prompt, `[phase=${phase}] serialised when-clause from '${table.id}' leaked`)
              .not.toContain(JSON.stringify(row.when));
          }
        }
      }
    });

    it("system prompt never contains the string 'science_model' or 'decision_table'", () => {
      // These internal names should not leak either — they hint at the shape
      // the tutor is not supposed to know about.
      const prompt = buildSystemPrompt(spec, baseInput("investigation"));
      expect(prompt).not.toContain("science_model");
      expect(prompt).not.toContain("decision_table");
    });
  });
}

/* ------------------------------------------------------------------ */
/* Positive assertions — the prompt has the parts it must have         */
/* ------------------------------------------------------------------ */

describe("build-system-prompt / positive assertions", () => {
  const spec = loadSpec(CLASS_9_PATH);

  it("includes the ROLE_BLOCK", () => {
    const prompt = buildSystemPrompt(spec, baseInput("provocation"));
    expect(prompt).toContain(ROLE_BLOCK);
  });

  it("includes the HARD_RULES_BLOCK", () => {
    const prompt = buildSystemPrompt(spec, baseInput("provocation"));
    expect(prompt).toContain("HARD RULES");
    expect(prompt).toContain(HARD_RULES_BLOCK);
  });

  it("includes the spec's fallback_when_asked_science string verbatim", () => {
    const prompt = buildSystemPrompt(spec, baseInput("investigation"));
    expect(prompt).toContain(
      spec.ai_tutor_config.fallback_when_asked_science.trim(),
    );
  });

  it("includes the current phase's own prompts", () => {
    const prompt = buildSystemPrompt(spec, baseInput("investigation"));
    for (const q of spec.investigation.questioning_prompts) {
      expect(prompt).toContain(q);
    }
    for (const h of spec.investigation.hypothesis_scaffolds) {
      expect(prompt).toContain(h);
    }
  });

  it("includes the lab topic and NCERT class + subject", () => {
    const prompt = buildSystemPrompt(spec, baseInput("provocation"));
    expect(prompt).toContain(spec.meta.topic);
    expect(prompt).toContain(String(spec.meta.ncert_class));
    expect(prompt).toContain(spec.meta.subject);
  });
});

/* ------------------------------------------------------------------ */
/* Phase scoping — current phase only                                  */
/* ------------------------------------------------------------------ */

describe("build-system-prompt / phase scoping", () => {
  const spec = loadSpec(CLASS_9_PATH);

  it("Provocation phase does NOT include Analysis's guiding_questions", () => {
    const prompt = buildSystemPrompt(spec, baseInput("provocation"));
    for (const q of spec.analysis.guiding_questions) {
      expect(prompt).not.toContain(q);
    }
  });

  it("Provocation phase does NOT include Analysis's expected_patterns", () => {
    const prompt = buildSystemPrompt(spec, baseInput("provocation"));
    for (const p of spec.analysis.expected_patterns) {
      expect(prompt).not.toContain(p);
    }
  });

  it("Analysis phase does NOT include Investigation's questioning_prompts", () => {
    const prompt = buildSystemPrompt(spec, baseInput("analysis"));
    for (const q of spec.investigation.questioning_prompts) {
      expect(prompt).not.toContain(q);
    }
  });

  it("Analysis phase DOES include expected_patterns with the 'do not reveal' instruction", () => {
    const prompt = buildSystemPrompt(spec, baseInput("analysis"));
    for (const p of spec.analysis.expected_patterns) {
      expect(prompt).toContain(p);
    }
    expect(prompt).toContain("do not reveal");
  });

});

/* ------------------------------------------------------------------ */
/* Student data block                                                  */
/* ------------------------------------------------------------------ */

describe("build-system-prompt / investigation summary", () => {
  const spec = loadSpec(CLASS_9_PATH);

  it("when investigation_summary is undefined, prompt contains no fabricated run data", () => {
    const prompt = buildSystemPrompt(spec, baseInput("analysis"));
    expect(prompt).toContain("NOT run any experiments yet");
    expect(prompt).toContain("Do not fabricate");
    // The "run N" pattern should not appear when there is no data.
    expect(prompt).not.toMatch(/Run 1 \(/);
  });

  it("when investigation_summary has runs, prompt includes a formatted table of those runs", () => {
    const summary: InvestigationSummary = {
      runs: [
        {
          id: "r1",
          timestamp: 1,
          experiment_id: "uniform_baseline",
          inputs: { speed: 10, time: 5 },
          outputs: {
            distance: { value: 50, status: "defined" },
          },
        },
        {
          id: "r2",
          timestamp: 2,
          experiment_id: "average_speed_puzzle",
          inputs: {
            leg1_distance: 500, leg1_time: 50,
            leg2_distance: 500, leg2_time: 100,
          },
          outputs: {
            average_speed: { value: 6.6667, status: "defined" },
            speed_leg1: { value: 10, status: "defined" },
            speed_leg2: { value: 5, status: "defined" },
          },
        },
      ],
      completed_at: 3,
    };
    const input: ChatWithTutorInput = {
      ...baseInput("analysis"),
      investigation_summary: summary,
    };
    const prompt = buildSystemPrompt(spec, input);

    expect(prompt).toContain("2 experiments");
    expect(prompt).toContain("Run 1 (uniform_baseline)");
    expect(prompt).toContain("Run 2 (average_speed_puzzle)");
    // Variable labels used, not raw ids:
    expect(prompt).toContain("Distance covered");
    expect(prompt).toContain("Average speed over both legs");
    // The correct value shows up:
    expect(prompt).toContain("50");
    expect(prompt).toContain("6.6667");
    // And the cite-run-numbers instruction is present:
    expect(prompt).toContain("cite specific run numbers");
  });

  it("undefined outputs render as 'undefined', not NaN or Infinity", () => {
    const summary: InvestigationSummary = {
      runs: [
        {
          id: "r1",
          timestamp: 1,
          experiment_id: "average_speed_puzzle",
          inputs: { leg1_distance: 100, leg1_time: 0 },
          outputs: {
            speed_leg1: { value: null, status: "undefined" },
            average_speed: { value: 20, status: "defined" },
          },
        },
      ],
      completed_at: 2,
    };
    const input: ChatWithTutorInput = {
      ...baseInput("analysis"),
      investigation_summary: summary,
    };
    const prompt = buildSystemPrompt(spec, input);
    expect(prompt).toContain("Speed on leg 1=undefined");
    expect(prompt).not.toContain("NaN");
    expect(prompt).not.toContain("Infinity");
  });
});

/* ------------------------------------------------------------------ */
/* Prior-response block                                                */
/* ------------------------------------------------------------------ */

describe("build-system-prompt / prior responses", () => {
  const spec = loadSpec(CLASS_9_PATH);

  it("includes prior phase responses when present", () => {
    const prompt = buildSystemPrompt(spec, {
      ...baseInput("analysis"),
      phase_responses: {
        provocation: "My friend is wrong because the times are different.",
      },
    });
    expect(prompt).toContain("provocation");
    expect(prompt).toContain("My friend is wrong");
  });

  it("does NOT include the investigation phase's JSON blob in the prior-responses block", () => {
    const jsonBlob = JSON.stringify({ runs: [], completed_at: 1 });
    const prompt = buildSystemPrompt(spec, {
      ...baseInput("analysis"),
      phase_responses: { investigation: jsonBlob },
    });
    expect(prompt).not.toContain(jsonBlob);
  });

  it("omits the prior-responses section entirely when nothing has been submitted", () => {
    const prompt = buildSystemPrompt(spec, baseInput("provocation"));
    expect(prompt).not.toContain("already submitted");
  });
});

/* ------------------------------------------------------------------ */
/* Determinism                                                          */
/* ------------------------------------------------------------------ */

describe("build-system-prompt / determinism", () => {
  it("is a pure function: same input → same output", () => {
    const spec = loadSpec(CLASS_9_PATH);
    const input = baseInput("investigation");
    const a = buildSystemPrompt(spec, input);
    const b = buildSystemPrompt(spec, input);
    expect(a).toBe(b);
  });
});
