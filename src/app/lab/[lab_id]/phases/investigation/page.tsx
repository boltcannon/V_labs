import { getLabSpec } from "@/app/lib/get-lab-spec";
import { toPublicPrediction } from "@/app/lib/to-public-spec";
import { LAB_STAGES } from "@/components/stage/stage-registry";
import { InvestigationShell } from "@/components/investigation/investigation-shell";
import { TutorPanel } from "@/components/tutor/tutor-panel";

interface Props {
  params: { lab_id: string };
}

export default function InvestigationPage({ params }: Props) {
  const spec = getLabSpec(params.lab_id);
  return (
    <div className="h-full flex flex-col">
      <InvestigationShell
        labId={params.lab_id}
        investigation={spec.investigation}
        variables={spec.science_model.variables}
        prediction={toPublicPrediction(spec)}
        stage={LAB_STAGES[params.lab_id]}
        scaffoldingLevel={spec.investigation.scaffolding_level}
      />
      <TutorPanel labId={params.lab_id} currentPhase="investigation" />
    </div>
  );
}
