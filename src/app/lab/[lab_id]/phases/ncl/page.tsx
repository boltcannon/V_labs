import { getLabSpec } from "@/app/lib/get-lab-spec";
import { PhaseCard } from "@/components/phase-card";
import { PromptAndResponse } from "@/components/prompt-and-response";
import { NclContent } from "@/components/spec-content/ncl-content";
import { TutorPanel } from "@/components/tutor/tutor-panel";

interface Props {
  params: { lab_id: string };
}

export default function NclPage({ params }: Props) {
  const spec = getLabSpec(params.lab_id);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <PhaseCard
          phaseId="ncl"
          phaseIndex={1}
          scaffolding={spec.ncl.scaffolding_level}
          subtitle="The vocabulary and ideas you'll need."
        >
          <NclContent ncl={spec.ncl} />
          <hr className="border-surface-border" />
          <PromptAndResponse
            phaseId="ncl"
            labId={params.lab_id}
            prompt="Note one thing that surprised you, and one question you still have."
            placeholder="Something you didn't expect · one open question"
          />
        </PhaseCard>
        <TutorPanel labId={params.lab_id} currentPhase="ncl" />
      </div>
    </div>
  );
}
