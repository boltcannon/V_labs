/**
 * Types for the Investigation phase's data history.
 *
 * Isomorphic: no React, no "use client" / "use server" directives — safe
 * to import from the Server Action, from client components, and later
 * from the AI tutor's server module.
 *
 * The student's investigation-phase response (in
 * `LabSessionState.phases.investigation.student_response`) is a JSON
 * string of `InvestigationSummary` so a later reader (AI tutor, teacher
 * export) can parse the runs directly without needing a database.
 */

import type { Scalar, VariableStatus } from "@/engine/types";

export interface RunOutput {
  value: Scalar | null;
  status: VariableStatus;
}

export interface ExperimentRun {
  /** Stable id — used as React key. */
  id: string;
  /** ms since epoch. */
  timestamp: number;
  /** An experiment id from the spec, or `FREE_EXPLORATION_ID`. */
  experiment_id: string;
  /** Only the inputs the tab exposed. Anything else is up to the engine. */
  inputs: Record<string, Scalar>;
  /**
   * Full outputs map, including derived vars. The UI filters by tab; the
   * AI tutor gets everything so it can reason about intermediates.
   */
  outputs: Record<string, RunOutput>;
  /** Set when the Server Action returned an error string. */
  error?: string;
  /**
   * The value the student said they expected for one output before this
   * run, if they gave one. Ungraded — only drawn as a "ghost" on the graph
   * next to the engine's real value.
   */
  expectation?: { y_variable: string; value: number };
}

export interface InvestigationSummary {
  runs: ExperimentRun[];
  completed_at: number;
}

export const FREE_EXPLORATION_ID = "free_exploration" as const;

/** Best-available uuid on both server and client. */
export function makeRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
