import "server-only";

import { MapPin, Search, HelpCircle } from "lucide-react";
import type { Provocation } from "@/schema/lab-spec";

interface Props {
  provocation: Provocation;
}

export function ProvocationContent({ provocation }: Props) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-accent/20 bg-accent-muted p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-strong">
          <MapPin className="w-3.5 h-3.5" />
          Real-world scenario
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-text">
          {provocation.real_life_scenario}
        </p>
      </div>

      <div className="rounded-lg border border-warning/20 bg-warning-muted p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-warning">
          <Search className="w-3.5 h-3.5" />
          Think about this
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-text">
          {provocation.curiosity_hook}
        </p>
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-muted p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <HelpCircle className="w-3.5 h-3.5" />
          Motivating question
        </div>
        <p className="mt-2 text-xl font-semibold leading-snug text-text">
          {provocation.motivating_question}
        </p>
      </div>
    </div>
  );
}
