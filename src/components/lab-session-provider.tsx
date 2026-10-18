"use client";

import { useCallback, useMemo, useState } from "react";
import {
  LabSessionContext,
  UNLOCK_NEXT,
  initialSessionState,
  type LabSessionState,
  type PhaseId,
} from "@/app/lib/session-state";

interface Props {
  labId: string;
  children: React.ReactNode;
}

export function LabSessionProvider({ labId, children }: Props) {
  const [state, setState] = useState<LabSessionState>(() =>
    initialSessionState(labId),
  );

  const setResponse = useCallback((id: PhaseId, text: string) => {
    setState((prev) => ({
      ...prev,
      phases: {
        ...prev.phases,
        [id]: { ...prev.phases[id], student_response: text },
      },
    }));
  }, []);

  const submitPhase = useCallback((id: PhaseId) => {
    setState((prev) => {
      const next = { ...prev.phases };
      next[id] = {
        ...next[id],
        status: "completed",
        submitted_at: Date.now(),
      };
      const unlock = UNLOCK_NEXT[id];
      if (unlock && next[unlock].status === "locked") {
        next[unlock] = { ...next[unlock], status: "active" };
      }
      return { ...prev, phases: next };
    });
  }, []);

  const setCurrentPhase = useCallback((id: PhaseId) => {
    setState((prev) => ({ ...prev, current_phase: id }));
  }, []);

  const value = useMemo(
    () => ({ state, setResponse, submitPhase, setCurrentPhase }),
    [state, setResponse, submitPhase, setCurrentPhase],
  );

  return (
    <LabSessionContext.Provider value={value}>
      {children}
    </LabSessionContext.Provider>
  );
}
