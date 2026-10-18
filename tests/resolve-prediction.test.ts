/**
 * Prediction resolution on the server (T4).
 *
 * The client never sees `correct_when`, `maps_to_misconception`, the
 * misconception ids, or `alternative_model` before a revision attempt.
 * The server runs the engine at the experiment's preset, evaluates every
 * option deterministically, and returns only what the student has earned
 * the right to see.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("openai", () => ({ default: class {} }));

import {
  resolvePrediction,
  revealAlternativeModel,
} from "../src/app/actions/prediction";
import { toPublicLabSpec, toPublicPrediction } from "../src/app/lib/to-public-spec";
import { GENERIC_REVISION_PROMPTS } from "../src/app/lib/prediction-flow";
import { loadSpec, CLASS_9_PATH, CLASS_10_PATH } from "./helpers";

const LAB = "class-10-physics-electricity";
const spec = loadSpec(CLASS_10_PATH);
const SECRETS = [
  ...spec.prediction!.items.flatMap((i) => i.options.map((o) => o.correct_when)),
  ...spec.misconceptions!.map((m) => m.revision.alternative_model.trim()),
  ...spec.misconceptions!.map((m) => m.id),
  ...spec.misconceptions!.map((m) => m.statement),
  "correct_when",
  "maps_to_misconception",
  "alternative_model",
];

function expectNoSecrets(value: unknown) {
  const json = JSON.stringify(value);
  for (const s of SECRETS) expect(json, `leaked: ${s}`).not.toContain(s);
}

/* ------------------------------------------------------------------ */
/* Public projection                                                    */
/* ------------------------------------------------------------------ */

describe("toPublicPrediction — what the client receives", () => {
  it("keeps questions and option labels", () => {
    const pub = toPublicPrediction(spec)!;
    expect(pub.gate).toBe(true);
    expect(pub.input_mode).toBe("choice");
    expect(pub.items.map((i) => i.id)).toEqual([
      "pred_current_after_bulb1",
      "pred_battery_current",
    ]);
    expect(pub.items[0]!.question).toBe(spec.prediction!.items[0]!.question);
    expect(pub.items[0]!.options).toEqual([
      { id: "opt_after_less", label: "Less than before the bulb" },
      { id: "opt_after_same", label: "The same as before the bulb" },
      { id: "opt_after_more", label: "More than before the bulb" },
    ]);
  });

  it("carries no answer key, mapping, misconception or model", () => {
    expectNoSecrets(toPublicPrediction(spec));
    expectNoSecrets(toPublicLabSpec(spec));
  });

  it("is undefined for a v1 spec", () => {
    expect(toPublicPrediction(loadSpec(CLASS_9_PATH))).toBeUndefined();
    expect(toPublicLabSpec(loadSpec(CLASS_9_PATH)).prediction).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* resolvePrediction                                                    */
/* ------------------------------------------------------------------ */

describe("resolvePrediction — M1 (current before/after bulb 1)", () => {
  it("a correct prediction matches, reveals the outcome, and needs no revision", async () => {
    const r = await resolvePrediction({ lab_id: LAB, item_id: "pred_current_after_bulb1", option_id: "opt_after_same" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolution.matched).toBe(true);
    expect(r.resolution.correct_option_id).toBe("opt_after_same");
    expect(r.resolution.revision).toBeNull();
    expect(r.resolution.experiment_id).toBe("exp_series_current");
    expect(r.resolution.inputs).toEqual({ v: 6, r1: 10, r2: 10 });
    expect(r.resolution.outputs.i_before_bulb1!.value).toBeCloseTo(0.3, 10);
    expect(r.resolution.outputs.i_after_bulb1!.value).toBeCloseTo(0.3, 10);
    expectNoSecrets(r);
  });

  it("the misconception option mismatches and returns the authored revision prompts, without the model", async () => {
    const r = await resolvePrediction({ lab_id: LAB, item_id: "pred_current_after_bulb1", option_id: "opt_after_less" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m1 = spec.misconceptions!.find((m) => m.id === "m_current_used_up")!;
    expect(r.resolution.matched).toBe(false);
    expect(r.resolution.correct_option_id).toBe("opt_after_same");
    expect(r.resolution.revision).toEqual({
      explain_prompt: m1.revision.explain_prompt,
      compare_prompt: m1.revision.compare_prompt,
      revise_prompt: m1.revision.revise_prompt,
      has_teacher_model: true,
    });
    expectNoSecrets(r);
  });

  it("a wrong option with no misconception gets the generic revision prompts and no model", async () => {
    const r = await resolvePrediction({ lab_id: LAB, item_id: "pred_current_after_bulb1", option_id: "opt_after_more" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolution.matched).toBe(false);
    expect(r.resolution.revision).toEqual({ ...GENERIC_REVISION_PROMPTS, has_teacher_model: false });
  });
});

describe("resolvePrediction — M2 (adding a second bulb)", () => {
  it("'stays the same' mismatches; the battery current at the preset drops from 0.6 A to 0.3 A", async () => {
    const r = await resolvePrediction({ lab_id: LAB, item_id: "pred_battery_current", option_id: "opt_battery_same" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.resolution.matched).toBe(false);
    expect(r.resolution.correct_option_id).toBe("opt_battery_lower");
    expect(r.resolution.outputs.i_single!.value).toBeCloseTo(0.6, 10);
    expect(r.resolution.outputs.i_series!.value).toBeCloseTo(0.3, 10);
    expect(r.resolution.revision?.has_teacher_model).toBe(true);
  });
});

describe("resolvePrediction — refusals", () => {
  it("unknown lab", async () => {
    const r = await resolvePrediction({ lab_id: "nope", item_id: "x", option_id: "y" });
    expect(r).toEqual({ ok: false, error: "Unknown lab 'nope'." });
  });

  it("a lab with no prediction section", async () => {
    const r = await resolvePrediction({ lab_id: "class-9-physics-motion", item_id: "x", option_id: "y" });
    expect(r.ok).toBe(false);
  });

  it("unknown item or option", async () => {
    expect((await resolvePrediction({ lab_id: LAB, item_id: "ghost", option_id: "opt_after_same" })).ok).toBe(false);
    expect((await resolvePrediction({ lab_id: LAB, item_id: "pred_current_after_bulb1", option_id: "ghost" })).ok).toBe(false);
    // An option from a different item is not accepted either.
    expect((await resolvePrediction({ lab_id: LAB, item_id: "pred_current_after_bulb1", option_id: "opt_battery_same" })).ok).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* revealAlternativeModel                                               */
/* ------------------------------------------------------------------ */

describe("revealAlternativeModel — only after a revision attempt", () => {
  const base = { lab_id: LAB, item_id: "pred_current_after_bulb1", option_id: "opt_after_less" };

  it("refuses without a revision attempt", async () => {
    expect((await revealAlternativeModel({ ...base, revise_text: "" })).ok).toBe(false);
    expect((await revealAlternativeModel({ ...base, revise_text: "   " })).ok).toBe(false);
  });

  it("returns the teacher-authored model after a revision attempt", async () => {
    const r = await revealAlternativeModel({ ...base, revise_text: "The current stays the same." });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const m1 = spec.misconceptions!.find((m) => m.id === "m_current_used_up")!;
      expect(r.text).toBe(m1.revision.alternative_model.trim());
    }
  });

  it("refuses for an option that maps to no misconception", async () => {
    const r = await revealAlternativeModel({ ...base, option_id: "opt_after_same", revise_text: "x" });
    expect(r.ok).toBe(false);
  });

  it("refuses an unknown lab, item or option", async () => {
    expect((await revealAlternativeModel({ ...base, lab_id: "nope", revise_text: "x" })).ok).toBe(false);
    expect((await revealAlternativeModel({ ...base, item_id: "ghost", revise_text: "x" })).ok).toBe(false);
    expect((await revealAlternativeModel({ ...base, option_id: "ghost", revise_text: "x" })).ok).toBe(false);
  });
});
