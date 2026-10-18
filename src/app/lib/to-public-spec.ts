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
} from "@/schema/lab-spec";

export function toPublicLabSpec(spec: ValidatedLabSpec): PublicLabSpec {
  return {
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
