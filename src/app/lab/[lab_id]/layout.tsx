import { notFound } from "next/navigation";

import { getLabSpec, LabNotFoundError } from "@/app/lib/get-lab-spec";
import { toPublicLabSpec } from "@/app/lib/to-public-spec";
import { LabShell } from "@/components/lab-shell";

interface Props {
  params: { lab_id: string };
  children: React.ReactNode;
}

export default function LabLayout({ params, children }: Props) {
  let spec;
  try {
    spec = getLabSpec(params.lab_id);
  } catch (err) {
    if (err instanceof LabNotFoundError) {
      notFound();
    }
    throw err;
  }
  const publicSpec = toPublicLabSpec(spec);
  return (
    <LabShell labId={params.lab_id} publicSpec={publicSpec}>
      {children}
    </LabShell>
  );
}
