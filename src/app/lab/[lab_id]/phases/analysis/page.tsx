import { getLabSpec } from "@/app/lib/get-lab-spec";
import { PhaseCard } from "@/components/phase-card";
import { PromptAndResponse } from "@/components/prompt-and-response";
import { AnalysisContent } from "@/components/spec-content/analysis-content";
import { TutorPanel } from "@/components/tutor/tutor-panel";

interface Props {
  params: { lab_id: string };
}

export default function AnalysisPage({ params }: Props) {
  const spec = getLabSpec(params.lab_id);
  return (
    <>
      <PhaseCard
        phaseId="analysis"
        phaseIndex={3}
        scaffolding={spec.analysis.scaffolding_level}
        subtitle="Make sense of what you found."
      >
        <AnalysisContent analysis={spec.analysis} />
        <hr className="border-surface-border" />
        <PromptAndResponse
          phaseId="analysis"
          labId={params.lab_id}
          prompt="Answer the guiding questions above using evidence from your experiments."
          placeholder="Point to specific runs from the Investigation phase where you can."
        />
      </PhaseCard>
      <TutorPanel labId={params.lab_id} currentPhase="analysis" />
    </>
  );
}
