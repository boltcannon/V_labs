import { getLabSpec } from "@/app/lib/get-lab-spec";
import { PhaseCard } from "@/components/phase-card";
import { PromptAndResponse } from "@/components/prompt-and-response";
import { ProvocationContent } from "@/components/spec-content/provocation-content";
import { TutorPanel } from "@/components/tutor/tutor-panel";

interface Props {
  params: { lab_id: string };
}

export default function ProvocationPage({ params }: Props) {
  const spec = getLabSpec(params.lab_id);
  return (
    <>
      <PhaseCard
        phaseId="provocation"
        phaseIndex={0}
        scaffolding={spec.provocation.scaffolding_level}
        subtitle="Ground the lab in something real."
      >
        <ProvocationContent provocation={spec.provocation} />
        <hr className="border-surface-border" />
        <PromptAndResponse
          phaseId="provocation"
          labId={params.lab_id}
          prompt="Write your initial thoughts on the motivating question."
          placeholder="What do you already think about this? Two or three sentences is fine."
        />
      </PhaseCard>
      <TutorPanel labId={params.lab_id} currentPhase="provocation" />
    </>
  );
}
