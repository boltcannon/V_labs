import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Beaker, Leaf, FlaskConical, Clock } from "lucide-react";
import type { LabSummary } from "@/app/lib/list-lab-specs";

const SUBJECT_STYLE: Record<string, { badge: string; accent: string; icon: typeof Beaker }> = {
  physics: {
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    accent: "group-hover:border-blue-300",
    icon: Beaker,
  },
  biology: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    accent: "group-hover:border-emerald-300",
    icon: Leaf,
  },
  chemistry: {
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    accent: "group-hover:border-amber-300",
    icon: FlaskConical,
  },
};

const DEFAULT_STYLE = {
  badge: "bg-gray-50 text-gray-700 border-gray-200",
  accent: "group-hover:border-gray-300",
  icon: Beaker,
};

function getStyle(subject: string) {
  return SUBJECT_STYLE[subject.toLowerCase()] ?? DEFAULT_STYLE;
}

interface Props {
  lab: LabSummary;
}

export function LabPickerCard({ lab }: Props) {
  const style = getStyle(lab.subject);
  const Icon = style.icon;

  return (
    <Link
      href={`/lab/${lab.lab_id}/phases/provocation`}
      className="block group"
    >
      <Card className={`transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${style.accent}`}>
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent-muted shrink-0">
              <Icon className="w-5 h-5 text-accent" />
            </div>
            <ArrowRight className="w-4 h-4 text-text-soft opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs border ${style.badge}`}>
              Class {lab.ncert_class} · {lab.subject}
            </Badge>
            {lab.estimated_duration_minutes && (
              <span className="inline-flex items-center gap-1 text-xs text-text-soft">
                <Clock className="w-3 h-3" />
                {lab.estimated_duration_minutes} min
              </span>
            )}
          </div>

          <h2 className="mt-3 text-lg font-semibold text-text group-hover:text-accent transition-colors leading-snug">
            {lab.topic}
          </h2>

          {lab.chapter_reference && (
            <p className="mt-2 text-sm text-text-muted line-clamp-2 leading-relaxed">
              {lab.chapter_reference}
            </p>
          )}
        </div>
      </Card>
    </Link>
  );
}
