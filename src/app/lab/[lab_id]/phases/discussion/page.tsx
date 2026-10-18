import { getLabSpec } from "@/app/lib/get-lab-spec";
import { PhaseCard } from "@/components/phase-card";
import { PromptAndResponse } from "@/components/prompt-and-response";
import { DiscussionContent } from "@/components/spec-content/discussion-content";
import { TutorPanel } from "@/components/tutor/tutor-panel";

interface Props {
  params: { lab_id: string };
}

export default function DiscussionPage({ params }: Props) {
  const spec = getLabSpec(params.lab_id);
  return (
    <>
      <PhaseCard
        phaseId="discussion"
        phaseIndex={4}
        scaffolding={spec.discussion.scaffolding_level}
        subtitle="Compare your findings with others."
      >
        <DiscussionContent discussion={spec.discussion} />
        <hr className="border-surface-border" />
        <PromptAndResponse
          phaseId="discussion"
          labId={params.lab_id}
          prompt="Write your response to the discussion prompts."
          placeholder="Note where you agreed with your peers, and where you didn't."
        />
      </PhaseCard>
      <TutorPanel labId={params.lab_id} currentPhase="discussion" />
    </>
  );
}
