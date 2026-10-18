import { getLabSpec } from "@/app/lib/get-lab-spec";
import { toPublicPrediction } from "@/app/lib/to-public-spec";
import { PhaseCard } from "@/components/phase-card";
import { InvestigationShell } from "@/components/investigation/investigation-shell";
import { TutorPanel } from "@/components/tutor/tutor-panel";

interface Props {
  params: { lab_id: string };
}

export default function InvestigationPage({ params }: Props) {
  const spec = getLabSpec(params.lab_id);
  return (
    <>
      <PhaseCard
        phaseId="investigation"
        phaseIndex={2}
        scaffolding={spec.investigation.scaffolding_level}
        subtitle="Experiment with the science model."
      >
        <div className="rounded-md border border-accent/20 bg-accent-muted px-4 py-2.5 text-xs text-accent-strong">
          Every value below is computed by the deterministic rule engine — not by an
          AI. Change the inputs, click Run, and read the numbers.
        </div>
        <InvestigationShell
          labId={params.lab_id}
          investigation={spec.investigation}
          variables={spec.science_model.variables}
          prediction={toPublicPrediction(spec)}
        />
      </PhaseCard>
      <TutorPanel labId={params.lab_id} currentPhase="investigation" />
    </>
  );
}
