"use client";

/**
 * Prediction gate panel (schema v2, T4) — choice mode.
 *
 *   1. The student picks an option and commits it. The Run button for
 *      this experiment stays locked until then.
 *   2. Reveal: their prediction next to the engine's readings at the
 *      experiment preset. Everything shown comes from the server's
 *      resolution — this component computes no science.
 *   3. On a mismatch: explain → compare → revise, in order. Only after the
 *      revision attempt is the teacher-authored model shown (if any).
 *
 * State lives in `prediction-flow.ts`; this component only renders it.
 */

import { useState } from "react";
import { Lock, Lightbulb, CheckCircle2, ArrowRight, BookOpen } from "lucide-react";

import type { PublicPrediction, Variable } from "@/schema/lab-spec";
import {
  REVISION_STEPS,
  type PredictionState,
  type RevisionStep,
} from "@/app/lib/prediction-flow";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import { ResultsPanel } from "./results-panel";

type Item = PublicPrediction["items"][number];

interface Props {
  item: Item;
  state: PredictionState;
  variables: Variable[];
  /** Variable ids this experiment measures — what the reveal shows. */
  measured: string[];
  pending: boolean;
  error: string | null;
  onSelect: (optionId: string) => void;
  onCommit: () => void;
  onAnswer: (step: RevisionStep, text: string) => void;
}

const STEP_LABELS: Record<RevisionStep, string> = {
  explain: "Explain",
  compare: "Compare",
  revise: "Revise",
};

export function PredictionPanel(props: Props) {
  const { item, state } = props;
  return (
    <div
      className="rounded-lg border border-accent/30 bg-accent-muted/40 p-4 space-y-4"
      data-testid="prediction-panel"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-strong">
        <Lightbulb className="w-3.5 h-3.5" />
        {state.stage === "choosing" ? "Predict first" : "Your prediction"}
      </div>
      <p className="text-[15px] font-medium leading-snug text-text">{item.question}</p>

      {state.stage === "choosing" ? (
        <Choosing {...props} selected={state.selected} />
      ) : (
        <Resolved {...props} state={state} />
      )}

      {props.error && (
        <p className="text-sm text-warning" role="alert">
          {props.error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Choosing({
  item,
  selected,
  pending,
  onSelect,
  onCommit,
}: Props & { selected: string | null }) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={item.question} className="space-y-2">
        {item.options.map((o) => {
          const isSel = o.id === selected;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              disabled={pending}
              onClick={() => onSelect(o.id)}
              className={cn(
                "w-full text-left rounded-md border px-3 py-2.5 text-sm transition",
                isSel
                  ? "border-accent bg-surface ring-2 ring-accent/40 font-medium"
                  : "border-surface-border bg-surface hover:border-accent/40",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-text-muted">
          <Lock className="w-3.5 h-3.5" />
          You can run this experiment once you commit a prediction.
        </p>
        <Button onClick={onCommit} disabled={selected === null || pending}>
          {pending ? "Checking…" : "Commit prediction"}
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Resolved({
  item,
  state,
  variables,
  measured,
  pending,
  onAnswer,
}: Props & { state: Extract<PredictionState, { stage: "resolved" }> }) {
  const { resolution } = state;
  const label = (id: string) => item.options.find((o) => o.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-surface-border bg-surface px-3 py-2 text-sm">
        <span className="text-text-muted">You predicted: </span>
        <span className="font-medium text-text">{label(resolution.chosen_option_id)}</span>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          What the engine found
        </div>
        <ResultsPanel variables={variables} varsToShow={measured} outputs={resolution.outputs} />
      </div>

      {resolution.matched ? (
        <div className="flex items-start gap-2 rounded-md border border-success/30 bg-success-muted px-3 py-2 text-sm text-text">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-success shrink-0" />
          <span>
            Your prediction matched the result. You can now run this experiment with other values.
          </span>
        </div>
      ) : (
        <div className="rounded-md border border-warning/30 bg-warning-muted px-3 py-2 text-sm text-text">
          The result was different from your prediction — it matched{" "}
          <span className="font-medium">&ldquo;{label(resolution.correct_option_id)}&rdquo;</span>.
          This is an opportunity for conceptual revision: work through the three steps below.
        </div>
      )}

      {resolution.revision && (
        <ol className="space-y-3" aria-label="Revision steps">
          {REVISION_STEPS.map((step, idx) => (
            <RevisionStepView
              key={step}
              index={idx}
              step={step}
              prompt={resolution.revision![`${step}_prompt`]}
              answer={state.answers[step]}
              current={state.step === step}
              pending={pending}
              onAnswer={onAnswer}
            />
          ))}
        </ol>
      )}

      {resolution.revision && state.step === "done" && (
        <div className="space-y-3">
          {resolution.revision.has_teacher_model &&
            (state.alternative_model ? (
              <div className="rounded-md border border-accent/30 bg-surface p-3" data-testid="teacher-model">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent-strong">
                  <BookOpen className="w-3.5 h-3.5" />
                  Your teacher&apos;s explanation
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-text">{state.alternative_model}</p>
              </div>
            ) : (
              <p className="text-xs text-text-soft">
                {pending ? "Loading your teacher's explanation…" : ""}
              </p>
            ))}
          <p className="text-xs text-text-muted">
            Revision done. You can now run this experiment with other values.
          </p>
        </div>
      )}
    </div>
  );
}

function RevisionStepView({
  index,
  step,
  prompt,
  answer,
  current,
  pending,
  onAnswer,
}: {
  index: number;
  step: RevisionStep;
  prompt: string;
  answer: string | undefined;
  current: boolean;
  pending: boolean;
  onAnswer: (step: RevisionStep, text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const done = answer !== undefined;
  return (
    <li
      className={cn(
        "rounded-md border p-3 space-y-2",
        current ? "border-accent/40 bg-surface" : "border-surface-border bg-surface/60",
        !current && !done && "opacity-60",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        Step {index + 1} · {STEP_LABELS[step]}
      </div>
      <p className="text-sm text-text">{prompt}</p>
      {done && <p className="text-sm italic text-text-muted">&ldquo;{answer}&rdquo;</p>}
      {current && (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a sentence or two."
            className="min-h-[5rem]"
            aria-label={`${STEP_LABELS[step]} — your answer`}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => onAnswer(step, draft)}
              disabled={draft.trim() === "" || pending}
            >
              {step === "revise" ? "Submit revision" : "Next"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </>
      )}
    </li>
  );
}
