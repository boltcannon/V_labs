"use server";

/**
 * Server Actions for the prediction gate (schema v2, T4).
 *
 * The client sends ids only; the server picks the spec, runs the engine
 * at the experiment preset, and evaluates the answer key. See
 * `app/lib/resolve-prediction.ts` for what is and isn't returned.
 */

import { getLabSpec, labExists } from "@/app/lib/get-lab-spec";
import {
  alternativeModelForSpec,
  resolvePredictionForSpec,
  type AlternativeModelResult,
  type ResolvePredictionResult,
} from "@/app/lib/resolve-prediction";

export async function resolvePrediction(input: {
  lab_id: string;
  item_id: string;
  option_id: string;
}): Promise<ResolvePredictionResult> {
  if (!labExists(input.lab_id)) {
    return { ok: false, error: `Unknown lab '${input.lab_id}'.` };
  }
  return resolvePredictionForSpec(getLabSpec(input.lab_id), input.item_id, input.option_id);
}

export async function revealAlternativeModel(input: {
  lab_id: string;
  item_id: string;
  option_id: string;
  revise_text: string;
}): Promise<AlternativeModelResult> {
  if (!labExists(input.lab_id)) {
    return { ok: false, error: `Unknown lab '${input.lab_id}'.` };
  }
  return alternativeModelForSpec(
    getLabSpec(input.lab_id),
    input.item_id,
    input.option_id,
    input.revise_text,
  );
}
