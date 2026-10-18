"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  UNLOCK_NEXT,
  useLabSession,
  wordCount,
  type PhaseId,
} from "@/app/lib/session-state";

interface Props {
  phaseId: PhaseId;
  labId: string;
  placeholder: string;
  /** The instruction the student is responding to, shown above the textarea. */
  prompt: string;
}

export function PromptAndResponse({ phaseId, labId, placeholder, prompt }: Props) {
  const { state, setResponse, submitPhase } = useLabSession();
  const router = useRouter();
  const phase = state.phases[phaseId];
  const submitted = phase.status === "completed";

  const onSubmit = () => {
    submitPhase(phaseId);
    const next = UNLOCK_NEXT[phaseId];
    if (next) router.push(`/lab/${labId}/phases/${next}`);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-sm font-medium text-text">Your response</div>
        <p className="text-sm text-text-muted">{prompt}</p>
      </div>
      <Textarea
        value={phase.student_response}
        onChange={(e) => setResponse(phaseId, e.target.value)}
        placeholder={placeholder}
        disabled={submitted}
      />
      <div className="flex items-center justify-between">
        <div className="text-xs text-text-soft">
          {wordCount(phase.student_response)} words
          {submitted && (
            <Badge variant="success" className="ml-2 gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Submitted
            </Badge>
          )}
        </div>
        {!submitted ? (
          <Button
            onClick={onSubmit}
            disabled={wordCount(phase.student_response) === 0}
          >
            Submit & continue
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          UNLOCK_NEXT[phaseId] && (
            <Button
              variant="outline"
              onClick={() => router.push(`/lab/${labId}/phases/${UNLOCK_NEXT[phaseId]}`)}
            >
              Next phase
              <ArrowRight className="w-4 h-4" />
            </Button>
          )
        )}
      </div>
    </div>
  );
}
