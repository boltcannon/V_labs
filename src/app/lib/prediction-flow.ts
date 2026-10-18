/**
 * Prediction gate — client-side flow (schema v2, T4).
 *
 * Isomorphic: no React, no directives. The PredictionPanel drives this
 * reducer; the server actions in `app/actions/prediction.ts` produce the
 * `PredictionResolution` it consumes.
 *
 *   choosing ──commit──▶ resolved
 *                          ├─ matched  → done (run unlocked)
 *                          └─ mismatch → explain → compare → revise → done
 *
 * A failed prediction is an opportunity for conceptual revision, not
 * proof of it, so after a mismatch the run stays locked until the student
 * has explained, compared and revised. Only then may the teacher-authored
 * alternative model be fetched (the server enforces this too).
 */

import type { Scalar } from "@/engine/types";
import type { RunOutput } from "@/app/lib/experiment-run";

export const REVISION_STEPS = ["explain", "compare", "revise"] as const;
export type RevisionStep = (typeof REVISION_STEPS)[number];

export interface RevisionPrompts {
  explain_prompt: string;
  compare_prompt: string;
  revise_prompt: string;
}

/**
 * Prompts for a wrong prediction that maps to no declared misconception.
 * Process wording only — they state no science.
 */
export const GENERIC_REVISION_PROMPTS: RevisionPrompts = {
  explain_prompt: "Look at the result from the engine. In your own words, what does it show?",
  compare_prompt: "Put your prediction next to the result. Where do they agree, and where do they differ?",
  revise_prompt: "Write your idea again so that it fits the result.",
};

/** What the server returns after a prediction is committed. */
export interface PredictionResolution {
  item_id: string;
  experiment_id: string;
  chosen_option_id: string;
  /** The option whose condition the engine found true at the preset. */
  correct_option_id: string;
  matched: boolean;
  /** The preset the engine ran at. */
  inputs: Record<string, Scalar>;
  outputs: Record<string, RunOutput>;
  /** null when matched. */
  revision: (RevisionPrompts & { has_teacher_model: boolean }) | null;
}

export type PredictionState =
  | { stage: "choosing"; selected: string | null }
  | {
      stage: "resolved";
      resolution: PredictionResolution;
      answers: Partial<Record<RevisionStep, string>>;
      step: RevisionStep | "done";
      alternative_model: string | null;
    };

export type PredictionAction =
  | { type: "select"; option_id: string }
  | { type: "resolved"; resolution: PredictionResolution }
  | { type: "answer"; step: RevisionStep; text: string }
  | { type: "alternative_model"; text: string };

export function initialPredictionState(): PredictionState {
  return { stage: "choosing", selected: null };
}

/** Invalid transitions return the state unchanged. */
export function predictionReducer(
  state: PredictionState,
  action: PredictionAction,
): PredictionState {
  switch (action.type) {
    case "select":
      if (state.stage !== "choosing") return state;
      return { stage: "choosing", selected: action.option_id };

    case "resolved":
      if (state.stage !== "choosing") return state;
      if (state.selected !== action.resolution.chosen_option_id) return state;
      return {
        stage: "resolved",
        resolution: action.resolution,
        answers: {},
        step: action.resolution.matched ? "done" : "explain",
        alternative_model: null,
      };

    case "answer": {
      if (state.stage !== "resolved" || state.step !== action.step) return state;
      const text = action.text.trim();
      if (text === "") return state;
      const next = REVISION_STEPS[REVISION_STEPS.indexOf(action.step) + 1] ?? "done";
      return { ...state, answers: { ...state.answers, [action.step]: text }, step: next };
    }

    case "alternative_model":
      if (
        state.stage !== "resolved" ||
        state.step !== "done" ||
        !state.answers.revise ||
        !state.resolution.revision?.has_teacher_model
      ) {
        return state;
      }
      return { ...state, alternative_model: action.text };
  }
}

/** The experiment's Run button unlocks only after the full sequence. */
export function isRunUnlocked(state: PredictionState | undefined): boolean {
  return state?.stage === "resolved" && state.step === "done";
}
