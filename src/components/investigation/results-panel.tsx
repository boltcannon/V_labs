"use client";

/**
 * Displays the outputs of the most recent run for a given experiment tab.
 *
 * Layout: one card per variable in `varsToShow`. Each card carries:
 *   - label + unit
 *   - the computed value, or "—" for undefined/not_computed
 *   - a status pill: ✅ defined / ⚠️ undefined / ⬜ not_computed
 *   - a one-line interpretation, but ONLY when the variable has a
 *     `description` field in the spec. The interpretation is the
 *     spec-authored `description`, NOT AI-generated (Principle 8).
 *     No fallback text — graceful omission.
 */

import { CheckCircle2, AlertTriangle, Square } from "lucide-react";
import type { Variable } from "@/schema/lab-spec";
import type { RunOutput } from "@/app/lib/experiment-run";
import { cn } from "@/lib/cn";

interface Props {
  variables: Variable[]; // full declared list; we look up by id
  varsToShow: string[];  // variable ids the current tab wants to display
  outputs: Record<string, RunOutput> | null;
  error?: string | null;
}

function StatusPill({ status }: { status: RunOutput["status"] }) {
  if (status === "defined") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-muted text-success px-2 py-0.5 text-[11px] font-medium">
        <CheckCircle2 className="w-3 h-3" />
        Defined
      </span>
    );
  }
  if (status === "undefined") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning-muted text-warning px-2 py-0.5 text-[11px] font-medium">
        <AlertTriangle className="w-3 h-3" />
        Undefined
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-locked-muted text-locked px-2 py-0.5 text-[11px] font-medium">
      <Square className="w-3 h-3" />
      Not computed
    </span>
  );
}

function formatValue(v: RunOutput["value"]): string {
  if (v === null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    // Show up to 4 significant digits, drop trailing zeros.
    if (Number.isInteger(v)) return String(v);
    return Number(v.toFixed(4)).toString();
  }
  return String(v).replace(/_/g, " ");
}

export function ResultsPanel({ variables, varsToShow, outputs, error }: Props) {
  const byId = new Map(variables.map((v) => [v.id, v]));

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-warning/40 bg-warning-muted p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-warning">
            Engine error
          </div>
          <p className="mt-1 text-sm text-text">{error}</p>
        </div>
      )}
      {!outputs && !error && (
        <div className="rounded-md border border-dashed border-surface-border p-4 text-sm text-text-soft">
          Click <span className="font-semibold text-text">Run experiment</span> to see the engine's outputs here.
        </div>
      )}
      {outputs && (
        <div className="grid gap-3 sm:grid-cols-2">
          {varsToShow.map((id) => {
            const v = byId.get(id);
            const o = outputs[id];
            if (!v) return null;
            const status = o?.status ?? "not_computed";
            const value = o?.value ?? null;
            const showValue = status === "defined";
            return (
              <div
                key={id}
                className={cn(
                  "rounded-lg border p-3 space-y-1.5",
                  status === "defined"
                    ? "border-surface-border bg-surface"
                    : status === "undefined"
                      ? "border-warning/30 bg-warning-muted/40"
                      : "border-surface-border bg-surface-muted",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text truncate">
                      {v.label}
                    </div>
                    {v.unit && (
                      <div className="text-[11px] text-text-soft">
                        {v.unit}
                      </div>
                    )}
                  </div>
                  <StatusPill status={status} />
                </div>
                <div
                  className={cn(
                    "text-lg font-mono tabular-nums",
                    showValue ? "text-text" : "text-text-soft",
                  )}
                >
                  {showValue ? formatValue(value) : "—"}
                </div>
                {status === "undefined" && (
                  <p className="text-xs text-text-muted">
                    Undefined — check your inputs (a divide-by-zero or missing value upstream).
                  </p>
                )}
                {v.description && (
                  <p className="text-xs text-text-muted leading-relaxed">
                    {v.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
