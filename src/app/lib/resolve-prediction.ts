/**
 * Server-side prediction resolution (schema v2, T4).
 *
 * This module reads `correct_when`, `maps_to_misconception` and
 * `alternative_model` — the answer key and the hidden model — so it is
 * `server-only`. It returns only what the student may see at each stage.
 *
 * Deterministic: the engine runs at the experiment's preset and each
 * option's condition is evaluated by the engine's own expression parser.
 * No LLM is involved in matching a prediction (CLAUDE.md §8 rule 3).
 *
 * Error messages are deliberately generic: a malformed spec must not leak
 * a `correct_when` string to the client through an error.
 */

import "server-only";

import type { ValidatedLabSpec } from "@/schema/lab-spec";
import { runLab } from "@/engine/rule-engine";
import type { EngineResult, Scalar } from "@/engine/types";
import {
  evaluateCondition,
  parseCondition,
} from "@/engine/expression-evaluator";
import type { RunOutput } from "@/app/lib/experiment-run";
import {
  GENERIC_REVISION_PROMPTS,
  type PredictionResolution,
} from "@/app/lib/prediction-flow";

export type ResolvePredictionResult =
  | { ok: true; resolution: PredictionResolution }
  | { ok: false; error: string };

export type AlternativeModelResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const CANNOT_CHECK =
  "This prediction can't be checked right now. Please tell your teacher.";

function conditionAt(source: string, result: EngineResult): boolean | null {
  let cond;
  try {
    cond = parseCondition(source);
  } catch {
    return null;
  }
  const scope: Record<string, Scalar> = {};
  for (const v of cond.variables) {
    if (result.status[v] !== "defined") return null;
    scope[v] = result.values[v] as Scalar;
  }
  const r = evaluateCondition(cond, scope);
  return r.ok ? r.value : null;
}

export function resolvePredictionForSpec(
  spec: ValidatedLabSpec,
  itemId: string,
  optionId: string,
): ResolvePredictionResult {
  const item = spec.prediction?.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, error: `Unknown prediction '${itemId}'.` };
  const chosen = item.options.find((o) => o.id === optionId);
  if (!chosen) return { ok: false, error: `Unknown option '${optionId}' for this prediction.` };

  const exp = spec.investigation.experiments.find((e) => e.id === item.experiment_ref);
  if (!exp?.preset) return { ok: false, error: CANNOT_CHECK };

  let result: EngineResult;
  try {
    result = runLab(spec, exp.preset);
  } catch {
    return { ok: false, error: CANNOT_CHECK };
  }

  const trueIds: string[] = [];
  for (const o of item.options) {
    const v = conditionAt(o.correct_when, result);
    if (v === null) return { ok: false, error: CANNOT_CHECK };
    if (v) trueIds.push(o.id);
  }
  // V2 guarantees exactly one; refuse rather than guess if a spec slipped through.
  if (trueIds.length !== 1) return { ok: false, error: CANNOT_CHECK };
  const correctId = trueIds[0]!;
  const matched = correctId === optionId;

  const outputs: Record<string, RunOutput> = {};
  for (const [id, status] of Object.entries(result.status)) {
    outputs[id] = { value: result.values[id] ?? null, status };
  }

  let revision: PredictionResolution["revision"] = null;
  if (!matched) {
    const mId = chosen.maps_to_misconception;
    if (mId != null) {
      const m = spec.misconceptions?.find((x) => x.id === mId);
      if (!m) return { ok: false, error: CANNOT_CHECK };
      revision = {
        explain_prompt: m.revision.explain_prompt.trim(),
        compare_prompt: m.revision.compare_prompt.trim(),
        revise_prompt: m.revision.revise_prompt.trim(),
        has_teacher_model: true,
      };
    } else {
      revision = { ...GENERIC_REVISION_PROMPTS, has_teacher_model: false };
    }
  }

  return {
    ok: true,
    resolution: {
      item_id: item.id,
      experiment_id: exp.id,
      chosen_option_id: optionId,
      correct_option_id: correctId,
      matched,
      inputs: { ...exp.preset },
      outputs,
      revision,
    },
  };
}

/**
 * The teacher-authored alternative model for the misconception the chosen
 * option maps to — only once the student has made a revision attempt.
 */
export function alternativeModelForSpec(
  spec: ValidatedLabSpec,
  itemId: string,
  optionId: string,
  reviseText: string,
): AlternativeModelResult {
  if (reviseText.trim() === "") {
    return { ok: false, error: "Write your revised idea first." };
  }
  const item = spec.prediction?.items.find((i) => i.id === itemId);
  const option = item?.options.find((o) => o.id === optionId);
  if (!item || !option) return { ok: false, error: "Unknown prediction or option." };
  const mId = option.maps_to_misconception;
  const m = mId != null ? spec.misconceptions?.find((x) => x.id === mId) : undefined;
  if (!m) return { ok: false, error: "There is no teacher model for this option." };
  return { ok: true, text: m.revision.alternative_model.trim() };
}
