"use client";

/**
 * Persistent left rail. Shows all 6 phases, their status, and (for
 * completed phases) the student's response word count. Also renders the
 * overall progress bar.
 *
 * Investigation gets a visually distinct state: not "locked" (so the user
 * can visit and see the placeholder), but a muted "simulation coming soon"
 * badge so it's clear the phase is intentionally un-submittable.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Beaker,
  Sparkles,
  BookOpenText,
  BarChart3,
  MessagesSquare,
  Compass,
  Lock,
  CircleDot,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import {
  COMING_SOON,
  PHASE_LABELS,
  PHASE_ORDER,
  SUBMITTABLE_PHASES,
  progressFraction,
  summariseCompletedResponse,
  useLabSession,
  type PhaseId,
} from "@/app/lib/session-state";

const ICONS: Record<PhaseId, LucideIcon> = {
  provocation: Sparkles,
  ncl: BookOpenText,
  investigation: Beaker,
  analysis: BarChart3,
  discussion: MessagesSquare,
  reflection: Compass,
};

interface Props {
  labId: string;
}

export function PhaseNavigator({ labId }: Props) {
  const { state } = useLabSession();
  const pathname = usePathname();
  const fraction = progressFraction(state);

  return (
    <aside className="w-72 shrink-0 border-r border-surface-border bg-surface flex flex-col">
      <div className="px-5 pt-5 pb-4 border-b border-surface-border">
        <div className="text-xs uppercase tracking-wider text-text-soft">
          Lab
        </div>
        <div className="mt-1 text-sm font-semibold text-text truncate">
          {labId}
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Progress</span>
            <span>
              {Math.round(fraction * 100)}%
              <span className="text-text-soft ml-1">
                ({SUBMITTABLE_PHASES.filter((id) => state.phases[id].status === "completed").length}
                /{SUBMITTABLE_PHASES.length})
              </span>
            </span>
          </div>
          <Progress value={fraction} />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <ol className="px-2 space-y-1">
          {PHASE_ORDER.map((id, i) => {
            const phase = state.phases[id];
            const Icon = ICONS[id];
            const href = `/lab/${labId}/phases/${id}`;
            const isActive = pathname === href;
            const isComingSoon = COMING_SOON.includes(id);
            const isInvestigation = id === "investigation";

            const statusBadge = () => {
              if (isComingSoon) {
                return <Badge variant="locked" className="gap-1"><Lock className="w-3 h-3" />Coming soon</Badge>;
              }
              if (phase.status === "completed") {
                return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" />Done</Badge>;
              }
              if (isInvestigation) {
                // Investigation is Active-but-muted when not completed;
                // the 'completed' case has already been handled above.
                return <Badge variant="muted" className="gap-1"><CircleDot className="w-3 h-3" />Active</Badge>;
              }
              if (phase.status === "active") {
                return <Badge variant="default" className="gap-1"><CircleDot className="w-3 h-3" />Active</Badge>;
              }
              return <Badge variant="locked" className="gap-1"><Lock className="w-3 h-3" />Locked</Badge>;
            };

            const isClickable =
              !isComingSoon && (phase.status === "active" || phase.status === "completed");

            const inner = (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-md px-3 py-2.5 border",
                  isActive
                    ? "bg-accent-muted border-accent/30"
                    : "bg-transparent border-transparent hover:bg-surface-muted",
                  !isClickable && "opacity-70 cursor-not-allowed hover:bg-transparent",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold",
                    phase.status === "completed"
                      ? "bg-success-muted text-success"
                      : phase.status === "active" && !isComingSoon
                        ? "bg-accent-muted text-accent-strong"
                        : "bg-surface-muted text-text-soft",
                  )}
                  aria-hidden
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-text-muted shrink-0" />
                    <div className="text-sm font-medium text-text truncate">
                      {PHASE_LABELS[id]}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center flex-wrap gap-1.5">
                    {statusBadge()}
                    {phase.status === "completed" && phase.student_response.length > 0 && (
                      <span className="text-[11px] text-text-soft">
                        {summariseCompletedResponse(id, phase.student_response)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );

            return (
              <li key={id}>
                {isClickable ? (
                  <Link href={href} aria-current={isActive ? "page" : undefined}>
                    {inner}
                  </Link>
                ) : (
                  <div aria-disabled>{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="px-5 py-3 border-t border-surface-border text-[11px] text-text-soft">
        v0.2.0 · shell only
      </div>
    </aside>
  );
}
