/**
 * Types shared between the AI tutor Server Action and the pure
 * system-prompt builder. Isomorphic — no React, no directives — so both
 * `"use server"` and `"use client"` files can import from here without
 * dragging a runtime boundary along.
 */

import type { PhaseId } from "@/app/lib/session-shared";
import type { InvestigationSummary } from "@/app/lib/experiment-run";

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatWithTutorInput {
  lab_id: string;
  current_phase: PhaseId;
  /** Full conversation so far. The server holds no session state. */
  messages: TutorMessage[];
  /**
   * The student's typed responses for phases that have been submitted.
   * `investigation` is intentionally excluded here — its response is a
   * JSON blob; it comes through `investigation_summary` instead.
   */
  phase_responses: Partial<Record<PhaseId, string>>;
  /** Parsed from the investigation phase's student_response, when present. */
  investigation_summary?: InvestigationSummary;
}
