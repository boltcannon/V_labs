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

  return {
    meta: { ...spec.meta, topic: "", authors: [""] },
    curriculum_alignment: spec.curriculum_alignment,
    variables: spec.science_model.variables,
    rules: spec.science_model.rules,
    decision_tables: spec.science_model.decision_tables ?? [],
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
