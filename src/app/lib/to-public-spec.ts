/**
 * ValidatedLabSpec → PublicLabSpec conversion.
 *
 * This module is intentionally isomorphic (no `server-only` marker). Server
 * code calls it just before crossing into a client component. It has no
 * side effects and no I/O — it's a projection.
 *
 * The projection strips two things: the `ValidatedLabSpec` phantom brand
 * (which cannot be serialised through the RSC boundary anyway), and the
 * `science_model.rules` and `science_model.decision_tables` fields (which
 * the client has no business seeing — the engine's contract with the AI
 * tutor is to answer questions ABOUT rules, not to hand them over).
 */

import type {
  ValidatedLabSpec,
  PublicLabSpec,
  PublicPrediction,
} from "@/schema/lab-spec";

/**
 * Schema v2 prediction, redacted for the client: questions and option
 * labels only. `correct_when` and `maps_to_misconception` stay on the
 * server; resolution happens in the `resolvePrediction` Server Action.
 */
export function toPublicPrediction(
  spec: ValidatedLabSpec,
): PublicPrediction | undefined {
  if (!spec.prediction) return undefined;
  return {
    gate: spec.prediction.gate,
    input_mode: spec.prediction.input_mode,
    items: spec.prediction.items.map((item) => ({
      id: item.id,
      experiment_ref: item.experiment_ref,
      question: item.question,
      options: item.options.map((o) => ({ id: o.id, label: o.label })),
    })),
  };
}

export function toPublicLabSpec(spec: ValidatedLabSpec): PublicLabSpec {
  const prediction = toPublicPrediction(spec);
  return {
    ...(prediction ? { prediction } : {}),
    meta: spec.meta,
    curriculum_alignment: spec.curriculum_alignment,
    science_model: { variables: spec.science_model.variables },
    provocation: spec.provocation,
    ncl: spec.ncl,
    investigation: spec.investigation,
    analysis: spec.analysis,
    discussion: spec.discussion,
    reflection: spec.reflection,
    assessment: spec.assessment,
    ai_tutor_config: spec.ai_tutor_config,
  };
}
