/**
 * Spec validator V1–V8 (T2). Each rule has a passing and a failing fixture.
 *
 * The validator runs on a loaded (Zod-valid) spec and checks what Zod
 * cannot: cross-references between the v2 sections, and engine-evaluated
 * properties of the prediction options (V2–V4). Everything is
 * deterministic — `correct_when` is evaluated by the engine's own
 * expression parser, and V4 samples with a seeded PRNG.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";
import { parseLabSpec } from "../src/loader/spec-loader";
import { runLab } from "../src/engine/rule-engine";
import { validateSpec, type SpecIssue } from "../src/validator/spec-validator";
import { loadSpec, REPO_ROOT, CLASS_6_PATH, CLASS_8_PATH, CLASS_9_PATH } from "./helpers";
import { v2Spec, brightnessSpec } from "./fixtures/v2-spec";

function validate(obj: unknown, opts?: { samples?: number; seed?: number }): SpecIssue[] {
  return validateSpec(parseLabSpec(yaml.dump(obj), "fixture"), opts);
}

const rulesOf = (issues: SpecIssue[]) => [...new Set(issues.map((i) => i.rule))].sort();
const messages = (issues: SpecIssue[]) => issues.map((i) => i.message).join("\n");

/** Assert the fixture fails ONLY the given rule, with a message containing `part`. */
function expectOnly(issues: SpecIssue[], rule: SpecIssue["rule"], part: string) {
  expect(rulesOf(issues), messages(issues)).toEqual([rule]);
  expect(messages(issues)).toContain(part);
}

/** Assert the fixture fails at least the given rule, with a message containing `part`. */
function expectIncludes(issues: SpecIssue[], rule: SpecIssue["rule"], part: string) {
  const forRule = issues.filter((i) => i.rule === rule);
  expect(forRule.length, messages(issues)).toBeGreaterThan(0);
  expect(messages(forRule)).toContain(part);
}

/** A second misconception, fully wired except for choice-point routing. */
function addSecondMisconception(spec: ReturnType<typeof v2Spec>) {
  spec.prediction.items.push({
    id: "pred_battery_current",
    experiment_ref: "exp_series_current",
    question: "q2",
    options: [
      { id: "opt_y", label: "y", correct_when: "i_series < 0", maps_to_misconception: "m_two" },
      { id: "opt_z", label: "z", correct_when: "i_series > 0", maps_to_misconception: null },
    ],
  });
  spec.misconceptions.push({
    id: "m_two",
    statement: "s",
    source: "src",
    detected_when: { prediction_option: "opt_y" },
    discrepant_event: { experiment_ref: "exp_series_current" },
    revision: { explain_prompt: "e", compare_prompt: "c", revise_prompt: "r", alternative_model: "a" },
  });
}

describe("validator — the base v2 fixture passes every rule", () => {
  it("returns no issues", () => {
    expect(validate(v2Spec())).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* V1 — misconception references exist; revision fields non-empty      */
/* ------------------------------------------------------------------ */

describe("V1 — misconception references", () => {
  it("fails when an option maps to an unknown misconception", () => {
    const s = v2Spec();
    s.prediction.items[0]!.options[0]!.maps_to_misconception = "m_ghost";
    expectOnly(validate(s), "V1", "unknown misconception 'm_ghost'");
  });

  it("fails when detected_when names an unknown prediction option", () => {
    const s = v2Spec();
    s.misconceptions[0]!.detected_when.prediction_option = "opt_ghost";
    expectOnly(validate(s), "V1", "unknown prediction option 'opt_ghost'");
  });

  it("fails when the discrepant event names an unknown experiment", () => {
    const s = v2Spec();
    s.misconceptions[0]!.discrepant_event.experiment_ref = "exp_ghost";
    expectOnly(validate(s), "V1", "unknown experiment 'exp_ghost'");
  });

  it("fails when the discrepant event is not the experiment that resolves the prediction", () => {
    const s = v2Spec();
    s.investigation.experiments.push({
      id: "exp_other",
      goal: "g",
      controlled_vars: [],
      manipulated_vars: ["v"],
      measured_vars: ["i_series"],
      preset: { v: 6, r1: 10, r2: 10 },
    });
    s.misconceptions[0]!.discrepant_event.experiment_ref = "exp_other";
    expectOnly(validate(s), "V1", "does not match");
  });

  it("fails when a revision field is whitespace only", () => {
    const s = v2Spec();
    s.misconceptions[0]!.revision.alternative_model = "   ";
    expectOnly(validate(s), "V1", "alternative_model");
  });
});

/* ------------------------------------------------------------------ */
/* V2 — exactly one option is correct at the preset                     */
/* ------------------------------------------------------------------ */

describe("V2 — exactly one correct option at the preset", () => {
  it("passes for the base fixture (only opt_same is true at v=6, r1=r2=10)", () => {
    expect(validate(v2Spec()).filter((i) => i.rule === "V2")).toEqual([]);
  });

  it("fails when two options are true at the preset", () => {
    const s = v2Spec();
    s.prediction.items[0]!.options[2]!.correct_when = "i_after_bulb1 >= i_before_bulb1";
    expectOnly(validate(s), "V2", "2 options are true");
  });

  it("fails when no option is true at the preset", () => {
    const s = v2Spec();
    s.prediction.items[0]!.options[1]!.correct_when = "i_after_bulb1 != i_before_bulb1";
    expectOnly(validate(s), "V2", "0 options are true");
  });

  it("fails when the item's experiment has no preset", () => {
    const s = v2Spec();
    delete (s.investigation.experiments[0] as { preset?: unknown }).preset;
    expectOnly(validate(s), "V2", "has no preset");
  });

  it("fails when the item names an unknown experiment", () => {
    const s = v2Spec();
    s.prediction.items[0]!.experiment_ref = "exp_ghost";
    expectIncludes(validate(s), "V2", "unknown experiment 'exp_ghost'");
  });

  it("fails when correct_when uses an undeclared variable", () => {
    const s = v2Spec();
    s.prediction.items[0]!.options[2]!.correct_when = "i_ghost > i_before_bulb1";
    expectOnly(validate(s), "V2", "unknown variable 'i_ghost'");
  });

  it("fails when correct_when does not parse", () => {
    const s = v2Spec();
    s.prediction.items[0]!.options[2]!.correct_when = "i_after_bulb1 <";
    expectOnly(validate(s), "V2", "does not parse");
  });

  it("fails when correct_when is not a true/false condition", () => {
    const s = v2Spec();
    s.prediction.items[0]!.options[2]!.correct_when = "i_after_bulb1 + 1";
    expectOnly(validate(s), "V2", "not true/false");
  });

  it("fails when a variable in correct_when is undefined at the preset", () => {
    const s = v2Spec();
    s.investigation.experiments[0]!.preset = { v: 6, r1: 10 }; // r2 missing
    expectOnly(validate(s), "V2", "not defined at the preset");
  });
});

/* ------------------------------------------------------------------ */
/* V3 — the misconception-mapped option is false at the preset          */
/* ------------------------------------------------------------------ */

describe("V3 — the event is discrepant at the preset", () => {
  it("passes for the base fixture (opt_less is false at the preset)", () => {
    expect(validate(v2Spec()).filter((i) => i.rule === "V3")).toEqual([]);
  });

  it("fails when the misconception is mapped to the option that comes true", () => {
    const s = v2Spec();
    const opts = s.prediction.items[0]!.options;
    opts[0]!.maps_to_misconception = null;
    opts[1]!.maps_to_misconception = "m_current_used_up";
    s.misconceptions[0]!.detected_when.prediction_option = "opt_same";
    expectIncludes(validate(s), "V3", "'opt_same'");
  });
});

/* ------------------------------------------------------------------ */
/* V4 — robustness across the unlocked variables' ranges                */
/* ------------------------------------------------------------------ */

describe("V4 — the discrepancy survives every reachable configuration", () => {
  it("passes for the current-based M1 prediction (same current for any r1, r2)", () => {
    expect(validate(v2Spec(), { samples: 200 })).toEqual([]);
  });

  it("THESIS FIXTURE: a brightness-based M1 prediction with r1 ≠ r2 reachable fails V4 and names the point", () => {
    const issues = validate(brightnessSpec());
    // V2 and V3 pass: at the preset the bulbs are equally bright.
    expectOnly(issues, "V4", "opt_b2_dimmer");
    const point = issues[0]!.point!;
    expect(point).toBeDefined();
    expect(point.r2 as number).toBeLessThan(point.r1 as number);
    // The named point is real: re-running the engine there confirms bulb 2 is dimmer.
    const spec = parseLabSpec(yaml.dump(brightnessSpec()), "fixture");
    const r = runLab(spec, point);
    expect(r.values.p2 as number).toBeLessThan(r.values.p1 as number);
    // And the message names the values so a teacher can see why.
    expect(issues[0]!.message).toContain("r1=");
    expect(issues[0]!.message).toContain("r2=");
  });

  it("the brightness prediction passes once r1 and r2 are locked at the preset", () => {
    const s = brightnessSpec();
    s.investigation.experiments[0]!.controlled_vars = ["r1", "r2"];
    s.investigation.experiments[0]!.manipulated_vars = ["v"];
    expect(validate(s, { samples: 200 })).toEqual([]);
  });

  it("is deterministic: the same seed names the same point", () => {
    const a = validate(brightnessSpec(), { seed: 42 });
    const b = validate(brightnessSpec(), { seed: 42 });
    expect(a).toEqual(b);
  });
});

/* ------------------------------------------------------------------ */
/* V5 — option ids unique; each maps to at most one misconception       */
/* ------------------------------------------------------------------ */

describe("V5 — unique options, one misconception each", () => {
  it("passes for the base fixture", () => {
    expect(validate(v2Spec()).filter((i) => i.rule === "V5")).toEqual([]);
  });

  it("fails when an option id is reused across items", () => {
    const s = v2Spec();
    s.prediction.items.push({
      id: "pred_second",
      experiment_ref: "exp_series_current",
      question: "q",
      options: [
        { id: "opt_same", label: "a", correct_when: "i_series > 0", maps_to_misconception: null },
        { id: "opt_x", label: "b", correct_when: "i_series <= 0", maps_to_misconception: null },
      ],
    });
    expectOnly(validate(s), "V5", "option id 'opt_same'");
  });

  it("fails when a prediction item id is reused", () => {
    const s = v2Spec();
    s.prediction.items.push({
      ...s.prediction.items[0]!,
      options: [
        { id: "opt_p", label: "a", correct_when: "i_series > 0", maps_to_misconception: null },
        { id: "opt_q", label: "b", correct_when: "i_series <= 0", maps_to_misconception: null },
      ],
    });
    expectOnly(validate(s), "V5", "item id 'pred_current_after_bulb1'");
  });

  it("fails when two misconceptions are detected by the same option", () => {
    const s = v2Spec();
    addSecondMisconception(s);
    s.misconceptions[1]!.detected_when.prediction_option = "opt_less";
    expectIncludes(validate(s), "V5", "'opt_less' is detected by 2 misconceptions");
  });
});

/* ------------------------------------------------------------------ */
/* V6 — choice points route to misconceptions; all reachable            */
/* ------------------------------------------------------------------ */

describe("V6 — choice-point routing", () => {
  it("passes for the base fixture", () => {
    expect(validate(v2Spec()).filter((i) => i.rule === "V6")).toEqual([]);
  });

  it("fails when a choice option routes to an unknown misconception", () => {
    const s = v2Spec();
    s.choice_points[0]!.options[0]!.routes_to_misconception = "m_ghost";
    expectOnly(validate(s), "V6", "unknown misconception 'm_ghost'");
  });

  it("fails when a misconception is not reachable from any choice option", () => {
    const s = v2Spec();
    addSecondMisconception(s);
    expectOnly(validate(s), "V6", "'m_two' is not reachable");
  });

  it("does not require choice points at all (reachability applies only when they exist)", () => {
    const s: Record<string, unknown> = v2Spec();
    delete s.choice_points;
    expect(validate(s)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* V7 — misconceptions require the prediction gate                      */
/* ------------------------------------------------------------------ */

describe("V7 — misconceptions need the gate on", () => {
  it("passes for the base fixture (gate: true)", () => {
    expect(validate(v2Spec()).filter((i) => i.rule === "V7")).toEqual([]);
  });

  it("fails when misconceptions exist and gate is false", () => {
    const s = v2Spec();
    s.prediction.gate = false;
    expectOnly(validate(s), "V7", "gate");
  });

  it("fails when misconceptions exist with no prediction section", () => {
    const s: Record<string, unknown> = v2Spec();
    delete s.prediction;
    expectIncludes(validate(s), "V7", "prediction");
  });

  it("allows gate: false when there are no misconceptions", () => {
    const s: Record<string, unknown> = v2Spec();
    (s.prediction as { gate: boolean }).gate = false;
    delete s.misconceptions;
    delete s.choice_points;
    (s.prediction as ReturnType<typeof v2Spec>["prediction"]).items[0]!.options[0]!
      .maps_to_misconception = null;
    expect(validate(s)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* V8 — v1 specs load unchanged                                         */
/* ------------------------------------------------------------------ */

describe("V8 — v1 specs load unchanged", () => {
  for (const p of [CLASS_6_PATH, CLASS_8_PATH, CLASS_9_PATH]) {
    it(`${p} loads and has no validator issues`, () => {
      expect(validateSpec(loadSpec(p))).toEqual([]);
    });
  }

  it("a v1 spec that gains a broken v2 section is caught (the validator is not vacuous on old specs)", () => {
    const raw = yaml.load(
      fs.readFileSync(path.join(REPO_ROOT, CLASS_9_PATH), "utf8"),
    ) as Record<string, unknown>;
    raw.prediction = {
      gate: true,
      input_mode: "choice",
      items: [
        {
          id: "pred_distance",
          experiment_ref: "uniform_baseline", // has no preset
          question: "q",
          options: [
            { id: "opt_a", label: "a", correct_when: "distance > 0" },
            { id: "opt_b", label: "b", correct_when: "distance <= 0" },
          ],
        },
      ],
    };
    expectOnly(validate(raw), "V2", "has no preset");
  });
});
