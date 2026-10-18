/**
 * Plain constants and types for the 6-phase shell.
 *
 * No "use client" directive, no React imports — safe to import from both
 * server and client components. Anything that touches React (Context,
 * hooks) lives in `session-state.ts` instead.
 */

export type PhaseId =
  | "provocation"
  | "ncl"
  | "investigation"
  | "analysis"
  | "discussion"
  | "reflection";

export const PHASE_ORDER: readonly PhaseId[] = [
  "provocation",
  "ncl",
  "investigation",
  "analysis",
  "discussion",
  "reflection",
] as const;

export const PHASE_LABELS: Record<PhaseId, string> = {
  provocation: "Provocation",
  ncl: "New Content Learning",
  investigation: "Investigation",
  analysis: "Analysis",
  discussion: "Discussion",
  reflection: "Reflection & Celebration",
};

/**
 * Phases the student is expected to submit. Investigation was added in
 * Prompt 3 when the simulation UI made it completable. Denominator = 6.
 */
export const SUBMITTABLE_PHASES: readonly PhaseId[] = [
  "provocation",
  "ncl",
  "investigation",
  "analysis",
  "discussion",
  "reflection",
] as const;

/**
 * On submitting the key phase, the value phase unlocks.
 *
 * Note the two unlock paths to Analysis: `ncl → analysis` (from Prompt 2)
 * and `investigation → analysis` (added Prompt 3). Both are idempotent —
 * whichever fires first unlocks Analysis; the second is a no-op. A student
 * who skips NCL and completes Investigation first will still unlock
 * Analysis, per the Prompt 3 Checkpoint 1 sign-off ("no gate — the linear
 * path is encouraged by AI tutor language later, not enforced here").
 */
export const UNLOCK_NEXT: Partial<Record<PhaseId, PhaseId>> = {
  provocation: "ncl",
  ncl: "analysis",
  investigation: "analysis",
  analysis: "discussion",
  discussion: "reflection",
};

/** Phases that are permanently locked until a later prompt. */
export const COMING_SOON: readonly PhaseId[] = [];

export type PhaseStatus = "locked" | "active" | "completed";

export interface PhaseState {
  id: PhaseId;
  status: PhaseStatus;
  student_response: string;
  submitted_at?: number;
}

export interface LabSessionState {
  lab_id: string;
  phases: Record<PhaseId, PhaseState>;
  current_phase: PhaseId;
}

export function initialSessionState(lab_id: string): LabSessionState {
  const phases: Record<PhaseId, PhaseState> = {} as Record<PhaseId, PhaseState>;
  for (const id of PHASE_ORDER) {
    let status: PhaseStatus = "locked";
    if (id === "provocation" || id === "investigation") status = "active";
    phases[id] = { id, status, student_response: "" };
  }
  return { lab_id, phases, current_phase: "provocation" };
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Human-readable summary of a phase's submitted content, for the navigator
 * badge. Investigation's `student_response` is a JSON `InvestigationSummary`
 * — we count its `runs` array and show "N runs" instead of pretending the
 * JSON is prose.
 */
export function summariseCompletedResponse(id: PhaseId, text: string): string {
  if (id === "investigation") {
    try {
      const parsed = JSON.parse(text) as { runs?: unknown[] };
      const n = Array.isArray(parsed.runs) ? parsed.runs.length : 0;
      return `${n} run${n === 1 ? "" : "s"}`;
    } catch {
      return "submitted";
    }
  }
  const words = wordCount(text);
  return `${words} word${words === 1 ? "" : "s"}`;
}

export function progressFraction(state: LabSessionState): number {
  const done = SUBMITTABLE_PHASES.filter(
    (id) => state.phases[id].status === "completed",
  ).length;
  return done / SUBMITTABLE_PHASES.length;
}
