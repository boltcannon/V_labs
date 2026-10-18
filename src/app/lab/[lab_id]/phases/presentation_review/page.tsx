import { Presentation } from "lucide-react";

import { PhaseCard } from "@/components/phase-card";

interface Props {
  params: { lab_id: string };
}

export default function PresentationReviewPage({ params }: Props) {
  void params;
  return (
    <PhaseCard
      phaseId="presentation_review"
      phaseIndex={6}
      scaffolding="medium"
      subtitle="Share your work and get feedback."
    >
      <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <Presentation className="w-3.5 h-3.5" />
          Coming soon
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-text">
          This phase will host the student's presentation of the artifact from Project
          Planning, with structured peer review against the rubric criteria. It becomes
          available in a later build.
        </p>
      </div>
    </PhaseCard>
  );
}
