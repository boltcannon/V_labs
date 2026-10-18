import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PHASE_LABELS, type PhaseId } from "@/app/lib/session-shared";

interface Props {
  phaseId: PhaseId;
  phaseIndex: number;
  scaffolding: "high" | "medium" | "low" | "none";
  subtitle?: string;
  children: React.ReactNode;
}

const SCAFFOLD_COPY: Record<"high" | "medium" | "low" | "none", string> = {
  high: "High support",
  medium: "Medium support",
  low: "Low support",
  none: "No support",
};

/**
 * Wrapper around a phase's content. Presentational, so it can render in a
 * server component (its child slots are what carry any client-ness).
 */
export function PhaseCard({ phaseId, phaseIndex, scaffolding, subtitle, children }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-text-soft">
            Phase {phaseIndex + 1} of 9
          </div>
          <h1 className="text-2xl font-semibold text-text mt-1">
            {PHASE_LABELS[phaseId]}
          </h1>
          {subtitle && (
            <p className="text-sm text-text-muted mt-1">{subtitle}</p>
          )}
        </div>
        <Badge variant="muted">{SCAFFOLD_COPY[scaffolding]}</Badge>
      </div>
      <Card>
        <CardContent className="space-y-6 py-6">{children}</CardContent>
      </Card>
    </div>
  );
}
