import { getLabSpec } from "@/app/lib/get-lab-spec";
import { PhaseCard } from "@/components/phase-card";
import { PromptAndResponse } from "@/components/prompt-and-response";
import { ReflectionContent } from "@/components/spec-content/reflection-content";
import { TutorPanel } from "@/components/tutor/tutor-panel";

interface Props {
  params: { lab_id: string };
}

export default function ReflectionPage({ params }: Props) {
  const spec = getLabSpec(params.lab_id);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PhaseCard
          phaseId="reflection"
          phaseIndex={5}
          scaffolding={spec.reflection.scaffolding_level}
          subtitle="Step back and look at how you learned."
        >
          <ReflectionContent reflection={spec.reflection} />
          <hr className="border-surface-border" />
          <PromptAndResponse
            phaseId="reflection"
            labId={params.lab_id}
            prompt="Write your reflection."
            placeholder="Where did your thinking change? What would you do differently?"
          />
        </PhaseCard>
        <TutorPanel labId={params.lab_id} currentPhase="reflection" />
      </div>
    </div>
  );
}
