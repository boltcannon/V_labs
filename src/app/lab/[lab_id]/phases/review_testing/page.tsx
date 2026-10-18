import { getLabSpec } from "@/app/lib/get-lab-spec";
import { PhaseCard } from "@/components/phase-card";
import { PromptAndResponse } from "@/components/prompt-and-response";
import { RubricDisplay } from "@/components/spec-content/rubric-display";
import { FormativeChecklist } from "@/components/formative-checklist";
import { TutorPanel } from "@/components/tutor/tutor-panel";

interface Props {
  params: { lab_id: string };
}

export default function ReviewTestingPage({ params }: Props) {
  const spec = getLabSpec(params.lab_id);
  return (
    <>
      <PhaseCard
      phaseId="review_testing"
      phaseIndex={8}
      scaffolding="none"
      subtitle="See where you are, and decide what's next."
    >
      <div className="space-y-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Rubric
          </div>
          <RubricDisplay rubric={spec.assessment.rubric} />
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            Formative checks
          </div>
          <FormativeChecklist items={spec.assessment.formative_checks} />
        </div>
      </div>
      <hr className="border-surface-border" />
      <PromptAndResponse
        phaseId="review_testing"
        labId={params.lab_id}
        prompt="What will you work on next based on this rubric?"
        placeholder="Pick one criterion you scored yourself lowest on and write what you'd try."
      />
      </PhaseCard>
      <TutorPanel labId={params.lab_id} currentPhase="review_testing" />
    </>
  );
}
