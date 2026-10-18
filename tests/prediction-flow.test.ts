/**
 * Prediction gate client flow (T4) — the pure state machine behind the
 * PredictionPanel. Choose → commit → reveal → (on a mismatch) explain →
 * compare → revise → unlocked. A run stays locked until that is done.
 */

import { describe, it, expect } from "vitest";
import {
  initialPredictionState,
  predictionReducer,
  isRunUnlocked,
  type PredictionResolution,
  type PredictionState,
} from "../src/app/lib/prediction-flow";

function resolution(matched: boolean, hasModel = !matched): PredictionResolution {
  return {
    item_id: "pred_current_after_bulb1",
    experiment_id: "exp_series_current",
    chosen_option_id: matched ? "opt_after_same" : "opt_after_less",
    correct_option_id: "opt_after_same",
    matched,
    inputs: { v: 6, r1: 10, r2: 10 },
    outputs: {
      i_before_bulb1: { value: 0.3, status: "defined" },
      i_after_bulb1: { value: 0.3, status: "defined" },
    },
    revision: matched
      ? null
      : {
          explain_prompt: "E",
          compare_prompt: "C",
          revise_prompt: "R",
          has_teacher_model: hasModel,
        },
  };
}

function run(...actions: Parameters<typeof predictionReducer>[1][]): PredictionState {
  return actions.reduce(predictionReducer, initialPredictionState());
}

describe("prediction flow — choosing", () => {
  it("starts with nothing selected and the run locked", () => {
    const s = initialPredictionState();
    expect(s).toEqual({ stage: "choosing", selected: null });
    expect(isRunUnlocked(s)).toBe(false);
    expect(isRunUnlocked(undefined)).toBe(false);
  });

  it("selecting an option records it but does not unlock the run", () => {
    const s = run({ type: "select", option_id: "opt_after_less" });
    expect(s).toEqual({ stage: "choosing", selected: "opt_after_less" });
    expect(isRunUnlocked(s)).toBe(false);
  });

  it("a resolution with no prior selection is ignored", () => {
    const s = run({ type: "resolved", resolution: resolution(true) });
    expect(s.stage).toBe("choosing");
  });

  it("a resolution for a different option than the one selected is ignored", () => {
    const s = run(
      { type: "select", option_id: "opt_after_more" },
      { type: "resolved", resolution: resolution(false) },
    );
    expect(s.stage).toBe("choosing");
  });
});

describe("prediction flow — a matched prediction", () => {
  it("unlocks the run straight after the reveal, with no revision steps", () => {
    const s = run(
      { type: "select", option_id: "opt_after_same" },
      { type: "resolved", resolution: resolution(true) },
    );
    expect(s.stage).toBe("resolved");
    if (s.stage === "resolved") expect(s.step).toBe("done");
    expect(isRunUnlocked(s)).toBe(true);
  });

  it("cannot change the selection after committing", () => {
    const s = run(
      { type: "select", option_id: "opt_after_same" },
      { type: "resolved", resolution: resolution(true) },
      { type: "select", option_id: "opt_after_less" },
    );
    expect(s.stage).toBe("resolved");
  });
});

describe("prediction flow — a mismatch requires explain, compare, revise in order", () => {
  const committed = [
    { type: "select", option_id: "opt_after_less" },
    { type: "resolved", resolution: resolution(false) },
  ] as const;

  it("starts at the explain step with the run locked", () => {
    const s = run(...committed);
    expect(s.stage === "resolved" && s.step).toBe("explain");
    expect(isRunUnlocked(s)).toBe(false);
  });

  it("ignores a blank answer", () => {
    const s = run(...committed, { type: "answer", step: "explain", text: "   " });
    expect(s.stage === "resolved" && s.step).toBe("explain");
  });

  it("ignores an answer to a step that is not current", () => {
    const s = run(...committed, { type: "answer", step: "revise", text: "skip ahead" });
    expect(s.stage === "resolved" && s.step).toBe("explain");
  });

  it("advances explain → compare → revise → done and then unlocks", () => {
    const s = run(
      ...committed,
      { type: "answer", step: "explain", text: "Both read 0.3 A." },
      { type: "answer", step: "compare", text: "I said less; it was the same." },
      { type: "answer", step: "revise", text: "The current is not used up." },
    );
    expect(s.stage).toBe("resolved");
    if (s.stage === "resolved") {
      expect(s.step).toBe("done");
      expect(s.answers).toEqual({
        explain: "Both read 0.3 A.",
        compare: "I said less; it was the same.",
        revise: "The current is not used up.",
      });
    }
    expect(isRunUnlocked(s)).toBe(true);
  });
});

describe("prediction flow — the alternative model", () => {
  const revised = [
    { type: "select", option_id: "opt_after_less" },
    { type: "resolved", resolution: resolution(false) },
    { type: "answer", step: "explain", text: "e" },
    { type: "answer", step: "compare", text: "c" },
  ] as const;

  it("is refused before the revise step is answered", () => {
    const s = run(...revised, { type: "alternative_model", text: "MODEL" });
    expect(s.stage === "resolved" && s.alternative_model).toBe(null);
  });

  it("is stored once the revision attempt is made", () => {
    const s = run(
      ...revised,
      { type: "answer", step: "revise", text: "r" },
      { type: "alternative_model", text: "MODEL" },
    );
    expect(s.stage === "resolved" && s.alternative_model).toBe("MODEL");
  });

  it("is refused when the option has no misconception (no authored model)", () => {
    const s = [
      { type: "select", option_id: "opt_after_less" },
      { type: "resolved", resolution: resolution(false, false) },
      { type: "answer", step: "explain", text: "e" },
      { type: "answer", step: "compare", text: "c" },
      { type: "answer", step: "revise", text: "r" },
      { type: "alternative_model", text: "MODEL" },
    ].reduce(
      (acc, a) => predictionReducer(acc, a as Parameters<typeof predictionReducer>[1]),
      initialPredictionState(),
    );
    expect(s.stage === "resolved" && s.alternative_model).toBe(null);
  });
});
