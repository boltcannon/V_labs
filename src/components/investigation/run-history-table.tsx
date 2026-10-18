"use client";

/**
 * Renders the student's data-history table.
 *
 * Columns are dynamic:
 *   - "Run #" (reverse-numbered so the newest is at the top)
 *   - "Experiment" badge
 *   - one column per input variable (in `inputVars` order — YAML order of
 *     `investigation.explorable_variables`)
 *   - a vertical divider
 *   - one column per output/derived variable (in `outputVars` order —
 *     YAML order of `science_model.variables` filtered by role)
 *
 * A cell whose value is `null` or whose status is `undefined` / `not_computed`
 * renders as a warn pill or a dash, never as a raw NaN or Infinity —
 * matching the engine's contract.
 */

import { Trash2, AlertTriangle } from "lucide-react";
import type { Variable } from "@/schema/lab-spec";
import type { ExperimentRun, RunOutput } from "@/app/lib/experiment-run";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

interface Props {
  runs: ExperimentRun[]; // full, oldest-first
  inputVars: Variable[];
  outputVars: Variable[];
  experiments: { id: string; label: string }[]; // for the filter dropdown
  filter: string; // "all" | experiment id | "free_exploration"
  onFilterChange: (v: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

function formatValue(v: RunOutput["value"] | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return Number(v.toFixed(4)).toString();
  }
  return String(v).replace(/_/g, " ");
}

function formatInput(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return String(v);
    return Number(v.toFixed(4)).toString();
  }
  return String(v).replace(/_/g, " ");
}

export function RunHistoryTable({
  runs,
  inputVars,
  outputVars,
  experiments,
  filter,
  onFilterChange,
  onClear,
  disabled,
}: Props) {
  const filtered = filter === "all" ? runs : runs.filter((r) => r.experiment_id === filter);
  // Newest first for display
  const rows = filtered.slice().reverse();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Data history
          </label>
          <Badge variant="muted">{filtered.length} of {runs.length} runs</Badge>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter runs by experiment"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="rounded-md border border-surface-border bg-surface px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            disabled={disabled ?? false}
          >
            <option value="all">All experiments</option>
            {experiments.map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            disabled={runs.length === 0 || (disabled ?? false)}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear history
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-surface-border p-4 text-center text-sm text-text-soft">
          No runs recorded {filter !== "all" && "for this experiment"} yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-surface-border">
          <table className="w-full text-xs">
            <thead className="bg-surface-muted">
              <tr>
                <th className="text-left px-2 py-2 font-semibold text-text-muted whitespace-nowrap">Run #</th>
                <th className="text-left px-2 py-2 font-semibold text-text-muted whitespace-nowrap">Experiment</th>
                {inputVars.map((v) => (
                  <th
                    key={`h-i-${v.id}`}
                    className="text-left px-2 py-2 font-semibold text-text-muted whitespace-nowrap"
                    scope="col"
                  >
                    {v.label}
                    {v.unit && <span className="ml-1 text-text-soft">({v.unit})</span>}
                  </th>
                ))}
                {outputVars.length > 0 && (
                  <th className="w-px bg-surface-border" aria-hidden />
                )}
                {outputVars.map((v) => (
                  <th
                    key={`h-o-${v.id}`}
                    className="text-left px-2 py-2 font-semibold text-accent-strong whitespace-nowrap"
                    scope="col"
                  >
                    {v.label}
                    {v.unit && <span className="ml-1 text-text-soft">({v.unit})</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((run, i) => {
                const runNumber = filtered.length - i;
                return (
                  <tr
                    key={run.id}
                    className={i > 0 ? "border-t border-surface-border" : ""}
                  >
                    <td className="px-2 py-1.5 text-text font-mono">{runNumber}</td>
                    <td className="px-2 py-1.5">
                      <Badge variant="muted">
                        {run.experiment_id.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    {inputVars.map((v) => (
                      <td
                        key={`c-i-${run.id}-${v.id}`}
                        className="px-2 py-1.5 font-mono tabular-nums"
                      >
                        {v.id in run.inputs ? formatInput(run.inputs[v.id]) : (
                          <span className="text-text-soft italic">not sent</span>
                        )}
                      </td>
                    ))}
                    {outputVars.length > 0 && (
                      <td className="w-px bg-surface-border" aria-hidden />
                    )}
                    {outputVars.map((v) => {
                      const o = run.outputs[v.id];
                      const s = o?.status ?? "not_computed";
                      const val = o?.value ?? null;
                      return (
                        <td
                          key={`c-o-${run.id}-${v.id}`}
                          className={cn(
                            "px-2 py-1.5 font-mono tabular-nums",
                            s === "undefined" && "bg-warning-muted/40",
                          )}
                        >
                          {s === "defined" ? (
                            formatValue(val)
                          ) : s === "undefined" ? (
                            <span className="inline-flex items-center gap-1 text-warning">
                              <AlertTriangle className="w-3 h-3" />
                              undef
                            </span>
                          ) : (
                            <span className="text-text-soft">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
