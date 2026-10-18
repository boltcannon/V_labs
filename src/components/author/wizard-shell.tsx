"use client";

/**
 * Wizard Shell — the top-level authoring wizard container.
 *
 * Responsibilities:
 *   - Manages the full WizardState via useState
 *   - Renders a step sidebar (12 steps + Review) with navigation
 *   - Renders the active step component in a scrollable main area
 *   - Provides Back / Next / Save navigation
 *   - Calls saveLabSpec server action on submit
 *   - Displays validation errors from the save action
 *   - Shows a YAML preview in the Review step
 */

import { useState, useCallback, useTransition, useMemo } from "react";
import yaml from "js-yaml";
import { cn } from "@/lib/cn";
import {
  type WizardState,
  WIZARD_STEPS,
  emptyWizardState,
  wizardStateToLabSpec,
} from "./wizard-types";
import {
  StepMeta,
  StepCurriculum,
  StepVariables,
  StepRules,
  StepDecisionTables,
  StepProvocation,
  StepNcl,
  StepInvestigation,
  StepAnalysis,
  StepDiscussion,
  StepReflection,
  StepAssessment,
} from "./wizard-steps";
import {
  saveLabSpec,
  type SaveLabSpecResult,
} from "@/app/actions/save-lab-spec";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REVIEW_STEP_ID = "review";

/** All navigable steps including the final Review. */
const ALL_STEPS = [
  ...WIZARD_STEPS,
  { id: REVIEW_STEP_ID, label: "Review & Save", shortLabel: "Review" },
];

/* ------------------------------------------------------------------ */
/*  Step renderer                                                      */
/* ------------------------------------------------------------------ */

function ActiveStep({
  stepId,
  state,
  onChange,
}: {
  stepId: string;
  state: WizardState;
  onChange: (s: WizardState) => void;
}) {
  switch (stepId) {
    case "meta":
      return <StepMeta state={state} onChange={onChange} />;
    case "curriculum":
      return <StepCurriculum state={state} onChange={onChange} />;
    case "variables":
      return <StepVariables state={state} onChange={onChange} />;
    case "rules":
      return <StepRules state={state} onChange={onChange} />;
    case "decision_tables":
      return <StepDecisionTables state={state} onChange={onChange} />;
    case "provocation":
      return <StepProvocation state={state} onChange={onChange} />;
    case "ncl":
      return <StepNcl state={state} onChange={onChange} />;
    case "investigation":
      return <StepInvestigation state={state} onChange={onChange} />;
    case "analysis":
      return <StepAnalysis state={state} onChange={onChange} />;
    case "discussion":
      return <StepDiscussion state={state} onChange={onChange} />;
    case "reflection":
      return <StepReflection state={state} onChange={onChange} />;
    case "assessment":
      return <StepAssessment state={state} onChange={onChange} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Review panel                                                       */
/* ------------------------------------------------------------------ */

function ReviewPanel({
  state,
  errors,
}: {
  state: WizardState;
  errors: Array<{ path: string; message: string }>;
}) {
  const yamlPreview = useMemo(() => {
    try {
      const spec = wizardStateToLabSpec(state);
      return yaml.dump(spec, {
        lineWidth: 100,
        noRefs: true,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: false,
      });
    } catch {
      return "Error generating YAML preview.";
    }
  }, [state]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text">YAML Preview</h3>
      <p className="text-xs text-text-muted">
        This is the YAML that will be validated through the{" "}
        <span className="font-mono">parseLabSpec</span> pipeline — the
        identical Zod schema used for hand-authored specs — and written to
        disk.
      </p>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-red-800">
            Validation errors ({errors.length})
          </p>
          {errors.map((e, i) => (
            <div key={i} className="text-xs text-red-700">
              <span className="font-mono">{e.path || "(root)"}</span>:{" "}
              {e.message}
            </div>
          ))}
        </div>
      )}

      <pre className="text-xs font-mono bg-surface-muted rounded-lg p-4 overflow-auto max-h-[60vh] whitespace-pre-wrap border border-surface-border">
        {yamlPreview}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Success panel                                                      */
/* ------------------------------------------------------------------ */

function SuccessPanel({ labId }: { labId: string }) {
  return (
    <div className="rounded-lg border border-green-300 bg-green-50 p-6 text-center space-y-4">
      <div className="text-3xl">✓</div>
      <h3 className="text-lg font-semibold text-green-800">Lab Spec Saved</h3>
      <p className="text-sm text-green-700">
        <span className="font-mono">{labId}.yaml</span> has been validated and
        written to <span className="font-mono">src/specs/</span>.
      </p>
      <div className="flex gap-3 justify-center pt-2">
        <a
          href={`/lab/${labId}`}
          className="px-4 py-2 text-sm rounded-md bg-accent text-text-inverse hover:bg-accent-strong transition"
        >
          Open Lab
        </a>
        <a
          href="/author"
          className="px-4 py-2 text-sm rounded-md border border-surface-border text-text-muted hover:border-accent hover:text-accent transition"
        >
          New Lab
        </a>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wizard Shell                                                       */
/* ------------------------------------------------------------------ */

export function WizardShell() {
  const [state, setState] = useState<WizardState>(emptyWizardState);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>(
    [],
  );
  const [savedLabId, setSavedLabId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeStep = ALL_STEPS[activeStepIdx]!;
  const isReview = activeStep.id === REVIEW_STEP_ID;
  const isFirstStep = activeStepIdx === 0;
  const isLastFormStep = activeStepIdx === ALL_STEPS.length - 2;

  const goBack = useCallback(() => {
    setActiveStepIdx((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setActiveStepIdx((i) => Math.min(ALL_STEPS.length - 1, i + 1));
  }, []);

  const goToStep = useCallback((idx: number) => {
    setActiveStepIdx(idx);
    setErrors([]);
  }, []);

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const spec = wizardStateToLabSpec(state);
      const result: SaveLabSpecResult = await saveLabSpec({ spec });
      if (result.ok) {
        setSavedLabId(result.labId);
        setErrors([]);
      } else {
        setErrors(result.errors);
      }
    });
  }, [state]);

  // If saved, show success panel
  if (savedLabId) {
    return (
      <div className="min-h-screen bg-surface-muted flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <SuccessPanel labId={savedLabId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted flex">
      {/* ---- Sidebar ---- */}
      <aside className="w-56 shrink-0 bg-surface border-r border-surface-border p-4 flex flex-col">
        <h2 className="text-sm font-semibold text-text mb-4 px-2">
          Authoring Wizard
        </h2>
        <nav className="flex-1 space-y-0.5 overflow-auto">
          {ALL_STEPS.map((step, idx) => {
            const isCurrent = idx === activeStepIdx;
            const isReviewStep = step.id === REVIEW_STEP_ID;
            return (
              <button
                key={step.id}
                onClick={() => goToStep(idx)}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs rounded-md transition",
                  isCurrent
                    ? "bg-accent/10 text-accent font-semibold"
                    : "text-text-muted hover:text-text hover:bg-surface-muted",
                  isReviewStep && "mt-3 border-t border-surface-border pt-3",
                )}
              >
                <span className="mr-2 text-text-soft">
                  {isReviewStep ? "✓" : `${idx + 1}.`}
                </span>
                {step.shortLabel}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ---- Main area ---- */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-surface border-b border-surface-border px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-semibold text-text">
              {activeStep.label}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Step {activeStepIdx + 1} of {ALL_STEPS.length}
              {state.meta.topic &&
                ` — ${state.meta.topic}`}
            </p>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            {isReview ? (
              <ReviewPanel state={state} errors={errors} />
            ) : (
              <ActiveStep
                stepId={activeStep.id}
                state={state}
                onChange={setState}
              />
            )}
          </div>
        </div>

        {/* Footer navigation */}
        <footer className="bg-surface border-t border-surface-border px-6 py-3 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={goBack}
            disabled={isFirstStep}
            className={cn(
              "px-4 py-2 text-sm rounded-md border transition",
              isFirstStep
                ? "border-surface-border text-text-soft cursor-not-allowed"
                : "border-surface-border text-text-muted hover:border-accent hover:text-accent",
            )}
          >
            Back
          </button>

          {isReview ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className={cn(
                "px-6 py-2 text-sm font-semibold rounded-md transition",
                isPending
                  ? "bg-accent/50 text-text-inverse cursor-wait"
                  : "bg-accent text-text-inverse hover:bg-accent-strong",
              )}
            >
              {isPending ? "Saving…" : "Save Lab Spec"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="px-4 py-2 text-sm rounded-md bg-accent text-text-inverse hover:bg-accent-strong transition"
            >
              {isLastFormStep ? "Review" : "Next"}
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}
