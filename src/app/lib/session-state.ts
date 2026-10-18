"use client";

import { createContext, useContext } from "react";
import type {
  LabSessionState,
  PhaseId,
} from "@/app/lib/session-shared";

export interface LabSessionContextValue {
  state: LabSessionState;
  setResponse: (id: PhaseId, text: string) => void;
  submitPhase: (id: PhaseId) => void;
  setCurrentPhase: (id: PhaseId) => void;
}

export const LabSessionContext =
  createContext<LabSessionContextValue | null>(null);

export function useLabSession(): LabSessionContextValue {
  const ctx = useContext(LabSessionContext);
  if (!ctx) {
    throw new Error("useLabSession must be used inside <LabSessionProvider>");
  }
  return ctx;
}

// Re-export the plain data so existing imports of session-state keep working.
export * from "@/app/lib/session-shared";
