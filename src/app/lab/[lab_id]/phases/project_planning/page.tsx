import { ClipboardList } from "lucide-react";

import { PhaseCard } from "@/components/phase-card";

interface Props {
  params: { lab_id: string };
}

export default function ProjectPlanningPage({ params }: Props) {
  void params;
  return (
    <PhaseCard
      phaseId="project_planning"
      phaseIndex={5}
      scaffolding="medium"
      subtitle="Plan the artifact you'll present."
    >
      <div className="rounded-lg border border-dashed border-surface-border bg-surface-muted p-6">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <ClipboardList className="w-3.5 h-3.5" />
          Coming soon
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-text">
          This phase will guide the student through planning the artifact they'll
          share in the Presentation & Review phase: what they'll build, the audience,
          the format, and a timeline. It becomes available in a later build.
        </p>
      </div>
    </PhaseCard>
  );
}
