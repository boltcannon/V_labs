/**
 * Schema v2 (T1) — shape validation for the new optional fields:
 *   science_model.validity_bounds, investigation.experiments[].preset,
 *   prediction, misconceptions, choice_points.
 *
 * Scope: field shapes plus preset-vs-variable checks. Cross-references
 * between the new sections and engine-evaluated checks (V1–V8) are T2.
 */

import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { labSpecSchema } from "../src/schema/lab-spec.zod";
import { parseLabSpec } from "../src/loader/spec-loader";
import { runLab } from "../src/engine/rule-engine";
import { toPublicLabSpec } from "../src/app/lib/to-public-spec";
import { buildSystemPrompt } from "../src/app/lib/build-system-prompt";
import type { PhaseId } from "../src/app/lib/session-shared";
import { loadSpec, CLASS_6_PATH, CLASS_8_PATH, CLASS_9_PATH } from "./helpers";
import { v2Spec } from "./fixtures/v2-spec";

function issues(spec: unknown): string {
  const r = labSpecSchema.safeParse(spec);
  return r.success ? "" : JSON.stringify(r.error.issues);
}

function expectInvalid(spec: unknown, messagePart?: string) {
  const r = labSpecSchema.safeParse(spec);
  expect(r.success).toBe(false);
  if (messagePart !== undefined && !r.success) {
    expect(JSON.stringify(r.error.issues)).toContain(messagePart);
  }
}

/* ------------------------------------------------------------------ */
/* v1 compatibility                                                    */
/* ------------------------------------------------------------------ */

describe("schema v2 — v1 specs load unchanged", () => {
  for (const p of [CLASS_6_PATH, CLASS_8_PATH, CLASS_9_PATH]) {
    it(`loads ${p} with no v2 fields present`, () => {
      const spec = loadSpec(p);
      expect(spec.prediction).toBeUndefined();
      expect(spec.misconceptions).toBeUndefined();
      expect(spec.choice_points).toBeUndefined();
      expect(spec.science_model.validity_bounds).toBeUndefined();
      for (const e of spec.investigation.experiments) {
        expect(e.preset).toBeUndefined();
      }
    });
  }
});

/* ------------------------------------------------------------------ */
/* Happy path                                                          */
/* ------------------------------------------------------------------ */

describe("schema v2 — happy path", () => {
  it("accepts the full v2 fixture", () => {
    expect(issues(v2Spec())).toBe("");
  });

  it("round-trips through YAML + the loader with every v2 field intact", () => {
    const spec = parseLabSpec(yaml.dump(v2Spec()), "v2-fixture");
    expect(spec.science_model.validity_bounds).toHaveLength(2);
    expect(spec.investigation.experiments[0]!.preset).toEqual({ v: 6, r1: 10, r2: 10 });
    expect(spec.prediction?.gate).toBe(true);
    expect(spec.prediction?.input_mode).toBe("choice");
    expect(spec.prediction?.items[0]!.options).toHaveLength(3);
    expect(spec.prediction?.items[0]!.options[0]!.correct_when).toBe(
      "i_after_bulb1 < i_before_bulb1",
    );
    expect(spec.misconceptions?.[0]!.revision.alternative_model).toBe(
      "FIXTURE_ALTERNATIVE_MODEL_TEXT",
    );
    expect(spec.choice_points?.[0]!.options[0]!.routes_to_misconception).toBe(
      "m_current_used_up",
    );
  });

  it("accepts maps_to_misconception as null or omitted", () => {
    const spec = v2Spec();
    const opts = spec.prediction.items[0]!.options;
    expect(opts[1]!.maps_to_misconception).toBeNull();
    expect("maps_to_misconception" in opts[2]!).toBe(false);
    expect(issues(spec)).toBe("");
  });

  it("each v2 section is independently optional", () => {
    const keys = ["prediction", "misconceptions", "choice_points"] as const;
    for (const k of keys) {
      const spec: Record<string, unknown> = v2Spec();
      delete spec[k];
      expect(issues(spec), `without ${k}`).toBe("");
    }
    const noBounds = v2Spec();
    delete (noBounds.science_model as { validity_bounds?: unknown }).validity_bounds;
    expect(issues(noBounds)).toBe("");
    const noPreset = v2Spec();
    delete (noPreset.investigation.experiments[0] as { preset?: unknown }).preset;
    expect(issues(noPreset)).toBe("");
  });

  it("the engine ignores the v2 fields and computes as before", () => {
    const spec = parseLabSpec(yaml.dump(v2Spec()), "v2-fixture");
    const r = runLab(spec, { v: 6, r1: 10, r2: 10 });
    expect(r.values.i_series).toBeCloseTo(0.3, 10);
    expect(r.values.i_after_bulb1).toBeCloseTo(0.3, 10);
  });
});

/* ------------------------------------------------------------------ */
/* validity_bounds                                                     */
/* ------------------------------------------------------------------ */

describe("schema v2 — science_model.validity_bounds", () => {
  it("rejects an empty string entry", () => {
    const spec = v2Spec();
    spec.science_model.validity_bounds.push("");
    expectInvalid(spec);
  });

  it("rejects a non-array value", () => {
    const spec = v2Spec();
    (spec.science_model as Record<string, unknown>).validity_bounds = "ideal wires";
    expectInvalid(spec);
  });
});

/* ------------------------------------------------------------------ */
/* experiments[].preset                                                */
/* ------------------------------------------------------------------ */

describe("schema v2 — experiments[].preset", () => {
  const preset = (spec: ReturnType<typeof v2Spec>) =>
    spec.investigation.experiments[0]!.preset;

  it("rejects a preset key that is not a declared variable", () => {
    const spec = v2Spec();
    preset(spec).ghost = 1;
    expectInvalid(spec, "preset references unknown variable 'ghost'");
  });

  it("rejects a preset on a non-input variable", () => {
    const spec = v2Spec();
    preset(spec).i_series = 0.3;
    expectInvalid(spec, "'i_series' which has role='derived'");
  });

  it("rejects a number outside the variable's range", () => {
    const spec = v2Spec();
    preset(spec).v = 24;
    expectInvalid(spec, "out of range [1.5, 12]");
  });

  it("rejects a value of the wrong type", () => {
    const spec = v2Spec();
    preset(spec).r1 = "ten";
    expectInvalid(spec, "expected number");
  });

  it("rejects a categorical value not in the options, and accepts one that is", () => {
    const spec = v2Spec();
    spec.science_model.variables.push({
      id: "bulb_type", label: "Bulb type", type: "categorical", unit: null,
      options: ["filament", "led"], role: "input",
    } as never);
    preset(spec).bulb_type = "halogen";
    expectInvalid(spec, "not in options");
    preset(spec).bulb_type = "led";
    expect(issues(spec)).toBe("");
  });

  it("rejects an uppercase preset key", () => {
    const spec = v2Spec();
    preset(spec).V = 6;
    expectInvalid(spec);
  });
});

/* ------------------------------------------------------------------ */
/* prediction                                                          */
/* ------------------------------------------------------------------ */

describe("schema v2 — prediction", () => {
  it("rejects input_mode outside choice | sort | numeric (no free text in v2)", () => {
    const spec = v2Spec();
    (spec.prediction as Record<string, unknown>).input_mode = "free_text";
    expectInvalid(spec);
  });

  it("accepts sort and numeric input modes", () => {
    for (const mode of ["sort", "numeric"]) {
      const spec = v2Spec();
      (spec.prediction as Record<string, unknown>).input_mode = mode;
      expect(issues(spec), mode).toBe("");
    }
  });

  it("rejects a missing or non-boolean gate", () => {
    const missing = v2Spec();
    delete (missing.prediction as { gate?: unknown }).gate;
    expectInvalid(missing);
    const wrong = v2Spec();
    (wrong.prediction as Record<string, unknown>).gate = "yes";
    expectInvalid(wrong);
  });

  it("rejects an empty items list", () => {
    const spec = v2Spec();
    spec.prediction.items = [];
    expectInvalid(spec);
  });

  it("rejects an item with fewer than two options", () => {
    const spec = v2Spec();
    spec.prediction.items[0]!.options = spec.prediction.items[0]!.options.slice(0, 1);
    expectInvalid(spec);
  });

  it("rejects an option with an empty correct_when", () => {
    const spec = v2Spec();
    spec.prediction.items[0]!.options[0]!.correct_when = "";
    expectInvalid(spec);
  });

  it("rejects an option id that is not snake_case", () => {
    const spec = v2Spec();
    spec.prediction.items[0]!.options[0]!.id = "Opt-Less";
    expectInvalid(spec, "snake_case");
  });

  it("rejects an item with no experiment_ref", () => {
    const spec = v2Spec();
    delete (spec.prediction.items[0] as { experiment_ref?: unknown }).experiment_ref;
    expectInvalid(spec);
  });
});

/* ------------------------------------------------------------------ */
/* misconceptions                                                      */
/* ------------------------------------------------------------------ */

describe("schema v2 — misconceptions", () => {
  const REVISION_FIELDS = [
    "explain_prompt",
    "compare_prompt",
    "revise_prompt",
    "alternative_model",
  ] as const;

  for (const field of REVISION_FIELDS) {
    it(`rejects a revision missing ${field}`, () => {
      const spec = v2Spec();
      delete (spec.misconceptions[0]!.revision as Record<string, unknown>)[field];
      expectInvalid(spec);
    });

    it(`rejects a revision with an empty ${field}`, () => {
      const spec = v2Spec();
      spec.misconceptions[0]!.revision[field] = "";
      expectInvalid(spec);
    });
  }

  it("rejects a misconception with no statement or no source", () => {
    const noStatement = v2Spec();
    noStatement.misconceptions[0]!.statement = "";
    expectInvalid(noStatement);
    const noSource = v2Spec();
    delete (noSource.misconceptions[0] as { source?: unknown }).source;
    expectInvalid(noSource);
  });

  it("rejects a misconception with no detected_when or discrepant_event", () => {
    const a = v2Spec();
    delete (a.misconceptions[0] as { detected_when?: unknown }).detected_when;
    expectInvalid(a);
    const b = v2Spec();
    delete (b.misconceptions[0] as { discrepant_event?: unknown }).discrepant_event;
    expectInvalid(b);
  });

  it("rejects an empty misconceptions list (omit the key instead)", () => {
    const spec = v2Spec();
    spec.misconceptions = [];
    expectInvalid(spec);
  });
});

/* ------------------------------------------------------------------ */
/* choice_points                                                       */
/* ------------------------------------------------------------------ */

describe("schema v2 — choice_points", () => {
  it("rejects an option without routes_to_misconception", () => {
    const spec = v2Spec();
    delete (spec.choice_points[0]!.options[0] as { routes_to_misconception?: unknown })
      .routes_to_misconception;
    expectInvalid(spec);
  });

  it("rejects a choice point with no options or an empty prompt", () => {
    const noOptions = v2Spec();
    noOptions.choice_points[0]!.options = [];
    expectInvalid(noOptions);
    const noPrompt = v2Spec();
    noPrompt.choice_points[0]!.prompt = "";
    expectInvalid(noPrompt);
  });
});

/* ------------------------------------------------------------------ */
/* Principle 8 — the answers stay on the server                        */
/* ------------------------------------------------------------------ */

describe("schema v2 — answers do not reach the client or the tutor", () => {
  const spec = parseLabSpec(yaml.dump(v2Spec()), "v2-fixture");
  const secrets = [
    ...spec.prediction!.items.flatMap((i) => i.options.map((o) => o.correct_when)),
    spec.misconceptions![0]!.revision.alternative_model,
  ];

  it("toPublicLabSpec drops prediction, misconceptions and choice_points", () => {
    const pub = JSON.stringify(toPublicLabSpec(spec));
    for (const s of secrets) expect(pub).not.toContain(s);
    expect(pub).not.toContain("correct_when");
  });

  it("the tutor system prompt contains no correct_when or alternative_model, on any phase", () => {
    const phases: PhaseId[] = [
      "provocation", "ncl", "investigation", "analysis", "discussion",
      "project_planning", "presentation_review", "reflection", "review_testing",
    ];
    for (const phase of phases) {
      const prompt = buildSystemPrompt(spec, {
        lab_id: "v2-fixture",
        current_phase: phase,
        messages: [],
        phase_responses: {},
      });
      for (const s of secrets) {
        expect(prompt, `[phase=${phase}] leaked '${s}'`).not.toContain(s);
      }
    }
  });
});
