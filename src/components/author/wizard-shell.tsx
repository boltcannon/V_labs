"use client";

import { useState, useCallback, useTransition, useMemo, useEffect } from "react";
import yaml from "js-yaml";
import { cn } from "@/lib/cn";
import Link from "next/link";
import {
  type WizardState,
  WIZARD_STEPS,
  emptyWizardState,
  wizardStateToLabSpec,
} from "./wizard-types";
import {
  StepAbout,
  StepScience,
  StepPhases,
  StepTutor,
} from "./wizard-steps";
import {
  saveLabSpec,
  type SaveLabSpecResult,
} from "@/app/actions/save-lab-spec";
import {
  getTemplateList,
  loadTemplate,
  type LabSummary,
} from "@/app/actions/load-template";

const REVIEW_STEP_ID = "review";

const ALL_STEPS = [
  ...WIZARD_STEPS,
  { id: REVIEW_STEP_ID, label: "Review & Save", shortLabel: "Review" },
];

const SUBJECT_LABELS: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  biology: "Biology",
  "integrated-science": "Integrated Science",
};

/* ------------------------------------------------------------------ */
/*  Template Picker                                                    */
/* ------------------------------------------------------------------ */

function TemplatePicker({
  onPickTemplate,
  onStartBlank,
}: {
  onPickTemplate: (labId: string) => void;
  onStartBlank: () => void;
}) {
  const [templates, setTemplates] = useState<LabSummary[] | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    getTemplateList().then(setTemplates);
  }, []);

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col">
      <header className="bg-surface border-b border-surface-border px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-text-soft hover:text-accent transition"
          >
            Home
          </Link>
          <div className="w-px h-4 bg-surface-border" />
          <span className="text-sm font-semibold text-text">Create a lab</span>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-text">
              How would you like to start?
            </h1>
            <p className="text-sm text-text-muted mt-2 max-w-lg mx-auto">
              Pick an existing lab as a template and customise it for your
              classroom, or start from scratch.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Template cards */}
            {templates === null ? (
              <div className="sm:col-span-2 text-center py-8 text-sm text-text-muted">
                Loading templates...
              </div>
            ) : (
              templates.map((t) => (
                <button
                  key={t.lab_id}
                  type="button"
                  disabled={loading !== null}
                  onClick={() => {
                    setLoading(t.lab_id);
                    onPickTemplate(t.lab_id);
                  }}
                  className={cn(
                    "text-left rounded-lg border p-5 transition group",
                    loading === t.lab_id
                      ? "border-accent bg-accent/5 cursor-wait"
                      : "border-surface-border bg-surface hover:border-accent hover:shadow-sm",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-medium text-accent">
                        Class {t.ncert_class} &middot;{" "}
                        {SUBJECT_LABELS[t.subject] ?? t.subject}
                      </span>
                      <h3 className="text-sm font-semibold text-text mt-1">
                        {t.topic}
                      </h3>
                    </div>
                    {loading === t.lab_id && (
                      <span className="text-xs text-accent shrink-0">Loading...</span>
                    )}
                  </div>
                  {t.chapter_reference && (
                    <p className="text-xs text-text-muted mt-2 line-clamp-2">
                      {t.chapter_reference}
                    </p>
                  )}
                  {t.estimated_duration_minutes && (
                    <p className="text-xs text-text-soft mt-1">
                      ~{t.estimated_duration_minutes} min
                    </p>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Start blank */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onStartBlank}
              disabled={loading !== null}
              className="text-sm text-text-muted hover:text-accent transition"
            >
              or start from a blank lab
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step renderer                                                      */
/* ------------------------------------------------------------------ */

function ActiveStep({
  stepId,
  state,
  onChange,
  fromTemplate,
}: {
  stepId: string;
  state: WizardState;
  onChange: (s: WizardState) => void;
  fromTemplate: boolean;
}) {
  switch (stepId) {
    case "about":
      return <StepAbout state={state} onChange={onChange} fromTemplate={fromTemplate} />;
    case "science":
      return (
        <StepScience
          state={state}
          onChange={onChange}
          readOnly={fromTemplate}
        />
      );
    case "phases":
      return <StepPhases state={state} onChange={onChange} />;
    case "tutor":
      return <StepTutor state={state} onChange={onChange} />;
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
      <p className="text-sm text-text-muted">
        This YAML will be validated through the same pipeline as hand-authored
        specs. Fix any errors below, then save.
      </p>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-red-800">
            {errors.length} validation error{errors.length === 1 ? "" : "s"}
          </p>
          {errors.map((e, i) => (
            <div key={i} className="text-xs text-red-700">
              <span className="font-mono">{e.path || "(root)"}</span>:{" "}
              {e.message}
            </div>
          ))}
        </div>
      )}

      <pre className="text-xs font-mono bg-surface-muted rounded-lg p-4 overflow-auto max-h-[50vh] whitespace-pre-wrap border border-surface-border">
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
    <div className="min-h-screen bg-surface-muted flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-green-300 bg-green-50 p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto text-green-600 text-xl font-bold">
          &#10003;
        </div>
        <h3 className="text-lg font-semibold text-green-800">Lab saved!</h3>
        <p className="text-sm text-green-700">
          <span className="font-mono">{labId}.yaml</span> has been validated and
          written to <span className="font-mono">src/specs/</span>.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <a
            href={`/lab/${labId}`}
            className="px-4 py-2 text-sm rounded-md bg-accent text-text-inverse hover:bg-accent-strong transition"
          >
            Open lab
          </a>
          <a
            href="/author"
            className="px-4 py-2 text-sm rounded-md border border-surface-border text-text-muted hover:border-accent hover:text-accent transition"
          >
            Create another
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step indicator (horizontal pills)                                  */
/* ------------------------------------------------------------------ */

function StepIndicator({
  steps,
  activeIdx,
  onGoTo,
}: {
  steps: typeof ALL_STEPS;
  activeIdx: number;
  onGoTo: (idx: number) => void;
}) {
  return (
    <nav aria-label="Wizard steps" className="flex items-center gap-1 flex-wrap">
      {steps.map((step, idx) => {
        const isDone = idx < activeIdx;
        const isCurrent = idx === activeIdx;
        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              onClick={() => onGoTo(idx)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition",
                isCurrent
                  ? "bg-accent text-text-inverse"
                  : isDone
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-surface-muted text-text-soft hover:text-text",
              )}
            >
              {isDone ? (
                <span className="text-green-600 font-bold">&#10003;</span>
              ) : (
                <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-bold">
                  {idx + 1}
                </span>
              )}
              <span className="hidden sm:inline">{step.shortLabel}</span>
            </button>
            {idx < steps.length - 1 && (
              <span className="text-text-soft mx-0.5 text-xs">&rsaquo;</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Wizard Shell                                                       */
/* ------------------------------------------------------------------ */

export function WizardShell() {
  const [mode, setMode] = useState<"pick" | "wizard">("pick");
  const [fromTemplate, setFromTemplate] = useState(false);
  const [state, setState] = useState<WizardState>(emptyWizardState);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [errors, setErrors] = useState<Array<{ path: string; message: string }>>(
    [],
  );
  const [savedLabId, setSavedLabId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handlePickTemplate = useCallback((labId: string) => {
    startTransition(async () => {
      const templateState = await loadTemplate(labId);
      setState(templateState);
      setFromTemplate(true);
      setMode("wizard");
    });
  }, []);

  const handleStartBlank = useCallback(() => {
    setState(emptyWizardState);
    setFromTemplate(false);
    setMode("wizard");
  }, []);

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

  if (savedLabId) {
    return <SuccessPanel labId={savedLabId} />;
  }

  if (mode === "pick") {
    return (
      <TemplatePicker
        onPickTemplate={handlePickTemplate}
        onStartBlank={handleStartBlank}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col">
      {/* Header */}
      <header className="bg-surface border-b border-surface-border px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-text-soft hover:text-accent transition"
            >
              Home
            </Link>
            <div className="w-px h-4 bg-surface-border" />
            <button
              type="button"
              onClick={() => {
                setMode("pick");
                setActiveStepIdx(0);
              }}
              className="text-xs text-text-soft hover:text-accent transition"
            >
              Templates
            </button>
            <div className="w-px h-4 bg-surface-border" />
            <span className="text-sm font-semibold text-text">
              {fromTemplate ? "Customise lab" : "Create a lab"}
            </span>
          </div>
          {state.meta.topic && (
            <span className="text-xs text-text-muted truncate max-w-[200px]">
              {state.meta.topic}
            </span>
          )}
        </div>
      </header>

      {/* Step indicator */}
      <div className="bg-surface border-b border-surface-border px-6 py-2.5">
        <div className="max-w-3xl mx-auto">
          <StepIndicator steps={ALL_STEPS} activeIdx={activeStepIdx} onGoTo={goToStep} />
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="mb-6">
            <div className="text-xs uppercase tracking-wider text-text-soft mb-1">
              Step {activeStepIdx + 1} of {ALL_STEPS.length}
            </div>
            <h1 className="text-xl font-semibold text-text">
              {activeStep.label}
            </h1>
            {activeStep.id === "about" && (
              <p className="text-sm text-text-muted mt-1">
                Name your lab and set the class, subject, and learning outcomes.
              </p>
            )}
            {activeStep.id === "science" && !fromTemplate && (
              <p className="text-sm text-text-muted mt-1">
                Define variables, formulas, and decision tables that power the simulation.
              </p>
            )}
            {activeStep.id === "phases" && (
              <p className="text-sm text-text-muted mt-1">
                Write the prompts students see in each phase of the lab.
              </p>
            )}
            {activeStep.id === "tutor" && (
              <p className="text-sm text-text-muted mt-1">
                Configure what the AI tutor can and cannot do, and set the assessment rubric.
              </p>
            )}
          </div>

          {isReview ? (
            <ReviewPanel state={state} errors={errors} />
          ) : (
            <ActiveStep
              stepId={activeStep.id}
              state={state}
              onChange={setState}
              fromTemplate={fromTemplate}
            />
          )}
        </div>
      </main>

      {/* Footer navigation */}
      <footer className="bg-surface border-t border-surface-border px-6 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
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
              {isPending ? "Saving..." : "Save lab spec"}
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
        </div>
      </footer>
    </div>
  );
}
