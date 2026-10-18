"use server";

import "server-only";

import { getLabSpec } from "@/app/lib/get-lab-spec";
import { listLabSummaries, type LabSummary } from "@/app/lib/list-lab-specs";
import type { WizardState } from "@/components/author/wizard-types";

export { type LabSummary };

export async function getTemplateList(): Promise<LabSummary[]> {
  return listLabSummaries();
}

export async function loadTemplate(labId: string): Promise<WizardState> {
  const spec = getLabSpec(labId);

  const ws: WizardState = {
    meta: { ...spec.meta, topic: "", authors: [""] },
    curriculum_alignment: spec.curriculum_alignment,
    variables: spec.science_model.variables,
    rules: spec.science_model.rules,
    decision_tables: spec.science_model.decision_tables ?? [],
    validity_bounds: spec.science_model.validity_bounds ?? [],
    provocation: spec.provocation,
    ncl: spec.ncl,
    investigation: spec.investigation,
    analysis: spec.analysis,
    discussion: spec.discussion,
    reflection: spec.reflection,
    assessment: spec.assessment,
    ai_tutor_config: spec.ai_tutor_config,
    misconceptions: spec.misconceptions ?? [],
    choice_points: spec.choice_points ?? [],
  };
  if (spec.prediction) ws.prediction = spec.prediction;
  return ws;
}
