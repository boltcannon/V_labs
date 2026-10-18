import { redirect } from "next/navigation";

interface Props {
  params: { lab_id: string };
}

export default function LabIndex({ params }: Props) {
  redirect(`/lab/${params.lab_id}/phases/provocation`);
}
