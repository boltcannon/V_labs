"use client";

/**
 * Collapsible AI-tutor chat panel.
 *
 * Mounts as a sibling to each phase's content in `<PhaseX>/page.tsx`, NOT
 * inside `[lab_id]/layout.tsx`. In the Next.js App Router, layout
 * components persist across child route changes; if TutorPanel lived in
 * the layout, its `useState<TutorMessage[]>` would carry across phase
 * navigation and break the "phase-scoped system prompt" contract. Mounting
 * in the page instead means the component remounts on every route change,
 * so the message history resets naturally.
 *
 * The floating "Ask the tutor" button and the drawer are `position: fixed`
 * in CSS — their DOM position (inside a phase page) does not have to match
 * their visual position (bottom-right of the viewport).
 */

import { useCallback, useMemo, useState, useTransition } from "react";
import { MessageCircle, X, Sparkles } from "lucide-react";

import type { PhaseId } from "@/app/lib/session-shared";
import type { InvestigationSummary } from "@/app/lib/experiment-run";
import type { TutorMessage } from "@/app/lib/tutor-types";
import { chatWithTutor } from "@/app/actions/chat-with-tutor";
import { useLabSession } from "@/app/lib/session-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { MessageList } from "./message-list";
import { MessageInput } from "./message-input";

interface Props {
  labId: string;
  currentPhase: PhaseId;
}

function parseInvestigationSummary(raw: string | undefined): InvestigationSummary | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as InvestigationSummary;
    if (!Array.isArray(parsed.runs)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function TutorPanel({ labId, currentPhase }: Props) {
  const { state } = useLabSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Build the payload from session context — the server assembles the
  // spec-side context itself.
  const phaseResponses = useMemo(() => {
    const out: Partial<Record<PhaseId, string>> = {};
    for (const [id, phase] of Object.entries(state.phases) as [PhaseId, typeof state.phases[PhaseId]][]) {
      if (phase.status === "completed" && phase.student_response.length > 0) {
        out[id] = phase.student_response;
      }
    }
    return out;
  }, [state.phases]);

  const investigationSummary = useMemo(
    () => parseInvestigationSummary(state.phases.investigation.student_response),
    [state.phases.investigation.student_response],
  );

  const send = useCallback(
    (text: string) => {
      const userMessage: TutorMessage = { role: "user", content: text };
      const next = [...messages, userMessage];
      setMessages(next);
      setError(null);

      startTransition(async () => {
        const out = await chatWithTutor({
          lab_id: labId,
          current_phase: currentPhase,
          messages: next,
          phase_responses: phaseResponses,
          ...(investigationSummary ? { investigation_summary: investigationSummary } : {}),
        });
        if (out.error) {
          setError(out.error);
          return;
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: out.reply },
        ]);
      });
    },
    [messages, labId, currentPhase, phaseResponses, investigationSummary],
  );

  return (
    <>
      {/* Floating trigger — hidden while the panel is open */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the AI tutor"
        className={cn(
          "fixed bottom-5 right-5 z-40 rounded-full shadow-lg transition",
          "bg-accent hover:bg-accent-strong text-text-inverse",
          "px-4 py-3 inline-flex items-center gap-2 text-sm font-medium",
          open && "opacity-0 pointer-events-none",
        )}
      >
        <Sparkles className="w-4 h-4" />
        Ask the tutor
      </button>

      {/* Drawer */}
      <div
        role="dialog"
        aria-label="AI tutor chat"
        aria-hidden={!open}
        className={cn(
          "fixed bottom-5 right-5 z-40 w-[380px] max-w-[calc(100vw-2.5rem)] h-[560px] max-h-[calc(100vh-2.5rem)]",
          "rounded-xl shadow-2xl border border-surface-border bg-surface",
          "flex flex-col overflow-hidden origin-bottom-right",
          "transition-transform duration-200",
          open ? "scale-100" : "scale-0 pointer-events-none",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-surface-border bg-surface-muted">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-strong" />
            <div className="text-sm font-semibold text-text">AI tutor</div>
            <span className="text-[10px] uppercase tracking-wider rounded-full bg-locked-muted text-locked px-1.5 py-0.5">
              {currentPhase.replace(/_/g, " ")}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close the tutor"
            className="rounded-md p-1 text-text-muted hover:text-text hover:bg-surface transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <MessageList messages={messages} pending={pending} error={error} />
        <MessageInput onSend={send} disabled={pending} />
      </div>

      {/* Hint when panel is closed and no conversation yet */}
      {!open && messages.length === 0 && (
        <div
          className="fixed bottom-5 right-40 z-40 hidden md:flex items-center gap-1.5 rounded-full bg-surface border border-surface-border shadow-sm px-3 py-1.5 text-xs text-text-muted"
          aria-hidden
        >
          <MessageCircle className="w-3.5 h-3.5 text-accent" />
          Stuck? Ask the tutor.
        </div>
      )}
    </>
  );
}
