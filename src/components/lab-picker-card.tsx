import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LabSummary } from "@/app/lib/list-lab-specs";

const SUBJECT_COLORS: Record<string, string> = {
  physics: "bg-blue-100 text-blue-800",
  biology: "bg-green-100 text-green-800",
  chemistry: "bg-amber-100 text-amber-800",
};

function subjectBadgeClass(subject: string): string {
  return SUBJECT_COLORS[subject.toLowerCase()] ?? "bg-gray-100 text-gray-800";
}

interface Props {
  lab: LabSummary;
}

export function LabPickerCard({ lab }: Props) {
  return (
    <Link
      href={`/lab/${lab.lab_id}/phases/provocation`}
      className="block group"
    >
      <Card className="transition-shadow hover:shadow-md hover:border-accent/40">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              className={subjectBadgeClass(lab.subject)}
            >
              Class {lab.ncert_class} · {lab.subject}
            </Badge>
            {lab.estimated_duration_minutes && (
              <span className="text-xs text-text-muted">
                ~{lab.estimated_duration_minutes} min
              </span>
            )}
          </div>
          <CardTitle className="text-lg group-hover:text-accent transition-colors">
            {lab.topic}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lab.chapter_reference && (
            <p className="text-sm text-text-muted line-clamp-2">
              {lab.chapter_reference}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
