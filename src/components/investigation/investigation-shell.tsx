"use client";

/**
 * The Investigation phase's live UI (Prompt 3 Checkpoint 3 — full).
 *
 * State:
 *   - activeTab: string
 *   - varValues: Record<varId, Scalar>   — sticky across tabs
 *   - runs: ExperimentRun[]              — appended per Run click
 *   - historyFilter: "all" | tab id      — filter for the history table
 *   - constantsOpen: boolean             — Set-constants collapse (per-tab)
 *   - pending: boolean                   — Server Action in flight
 *   - lastError: string | null
 *
 * Flow:
 *   1. Assemble `inputs` from `varValues` — only vars this tab exposes
 *      (controlled + manipulated).
 *   2. Await `runExperiment(...)` — server calls `runLab` against its
 *      own `ValidatedLabSpec`.
 *   3. Append an `ExperimentRun` to `runs`.
 *   4. Results panel derives from the last matching run in `runs` for
 *      the current tab.
 *   5. Data-history table renders all runs (filterable).
 *   6. "I'm done exploring" button enabled once runs.length >= 1;
 *      writes a JSON `InvestigationSummary` into
 *      `LabSessionState.phases.investigation.student_response`, marks
 *      the phase completed, unlocks Analysis via `UNLOCK_NEXT`.
 */

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Beaker, Compass, Settings2, ChevronDown, ChevronRight, ArrowRight, CheckCircle2, Lock } from "lucide-react";

import type { Investigation, PublicPrediction, Variable } from "@/schema/lab-spec";
import type { Scalar } from "@/engine/types";
import {
  FREE_EXPLORATION_ID,
  makeRunId,
  type ExperimentRun,
  type InvestigationSummary,
  type RunOutput,
} from "@/app/lib/experiment-run";
import { runExperiment } from "@/app/actions/run-experiment";
import { resolvePrediction, revealAlternativeModel } from "@/app/actions/prediction";
import {
  initialPredictionState,
  isRunUnlocked,
  predictionReducer,
  type PredictionAction,
  type PredictionState,
  type RevisionStep,
} from "@/app/lib/prediction-flow";
import {
  useLabSession,
} from "@/app/lib/session-state";
import { UNLOCK_NEXT } from "@/app/lib/session-shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { VariableControl, VariableReadonly, defaultValue } from "./variable-control";
import { ResultsPanel } from "./results-panel";
import { RunHistoryTable } from "./run-history-table";
import { PredictionPanel } from "./prediction-panel";
import { CircuitStage } from "@/components/stage/circuit-stage";
import { circuitStagePropsFromRun } from "@/components/stage/circuit-stage-adapter";
import type { StageKind } from "@/components/stage/stage-registry";

interface Props {
  labId: string;
  investigation: Investigation;
  variables: Variable[];
  /** Schema v2, redacted (no answer key). Absent for v1 labs. */
  prediction?: PublicPrediction | undefined;
  /**
   * Live visual stage for this lab, if any. When set, settling a control
   * runs the engine (via the runExperiment Server Action) and the stage
   * redraws from the run's outputs.
   */
  stage?: StageKind | undefined;
}

interface TabSpec {
  id: string;
  label: string;
  goal?: string;
  controlled: string[];
  manipulated: string[];
  measured: string[];
}

export function InvestigationShell({ labId, investigation, variables, prediction, stage }: Props) {
  const varsById = useMemo(
    () => new Map(variables.map((v) => [v.id, v])),
    [variables],
  );

  const tabs: TabSpec[] = useMemo(() => {
    const named = investigation.experiments.map((e) => ({
      id: e.id,
      label: e.id.replace(/_/g, " "),
      goal: e.goal,
      controlled: e.controlled_vars,
      manipulated: e.manipulated_vars,
      measured: e.measured_vars,
    }));
    const free: TabSpec = {
      id: FREE_EXPLORATION_ID,
      label: "Free exploration",
      controlled: [],
      manipulated: investigation.explorable_variables,
      measured: variables
        .filter((v) => v.role === "output" || v.role === "derived")
        .map((v) => v.id),
    };
    return [...named, free];
  }, [investigation, variables]);

  const [activeTab, setActiveTab] = useState<string>(tabs[0]!.id);
  const [constantsOpen, setConstantsOpen] = useState<boolean>(false);

  /* ---- Prediction gate (schema v2) ---- */
  // Only a gated prediction locks runs. Items are matched to tabs by
  // experiment id; the answer key never reaches this component.
  const gate = prediction?.gate === true;
  const itemForTab = useCallback(
    (tabId: string) =>
      gate ? prediction!.items.find((i) => i.experiment_ref === tabId) : undefined,
    [gate, prediction],
  );
  const presetFor = useCallback(
    (tabId: string) => investigation.experiments.find((e) => e.id === tabId)?.preset,
    [investigation],
  );
  const [predictions, setPredictions] = useState<Record<string, PredictionState>>({});
  const [predError, setPredError] = useState<string | null>(null);
  const [predPending, startPredTransition] = useTransition();

  const dispatchPrediction = useCallback((itemId: string, action: PredictionAction) => {
    setPredictions((prev) => ({
      ...prev,
      [itemId]: predictionReducer(prev[itemId] ?? initialPredictionState(), action),
    }));
  }, []);

  // Sticky variable values across tabs. A gated first tab starts at its
  // preset, so the controls show the configuration being predicted about.
  const [varValues, setVarValues] = useState<Record<string, Scalar>>(() => {
    const seed: Record<string, Scalar> = {};
    for (const id of investigation.explorable_variables) {
      const v = varsById.get(id);
      if (v) seed[id] = defaultValue(v);
    }
    const first = tabs[0]!.id;
    if (gate && prediction!.items.some((i) => i.experiment_ref === first)) {
      Object.assign(seed, investigation.experiments.find((e) => e.id === first)?.preset ?? {});
    }
    return seed;
  });

  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  const [pending, startTransition] = useTransition();
  const [lastError, setLastError] = useState<string | null>(null);

  const { state, setResponse, submitPhase } = useLabSession();
  const router = useRouter();

  const investigationCompleted =
    state.phases.investigation.status === "completed";

  const setValue = useCallback((id: string, v: Scalar) => {
    setVarValues((prev) => ({ ...prev, [id]: v }));
  }, []);

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0]!;

  const lastRunForTab = useMemo(() => {
    for (let i = runs.length - 1; i >= 0; i--) {
      if (runs[i]!.experiment_id === currentTab.id) return runs[i]!;
    }
    return null;
  }, [runs, currentTab.id]);

  /**
   * `overrides` carries a value that has just settled (slider release) so
   * the run uses it even if the matching state update hasn't rendered yet.
   */
  const runNow = useCallback((overrides: Record<string, Scalar> = {}) => {
    const varsExposed = new Set([
      ...currentTab.controlled,
      ...currentTab.manipulated,
    ]);
    const values = { ...varValues, ...overrides };
    const inputs: Record<string, Scalar> = {};
    for (const id of varsExposed) {
      if (id in values) inputs[id] = values[id]!;
    }
    startTransition(async () => {
      const out = await runExperiment({
        lab_id: labId,
        inputs,
        experiment_id: currentTab.id,
      });
      const outputs: Record<string, RunOutput> = {};
      for (const [id, status] of Object.entries(out.result.status)) {
        outputs[id] = {
          value: out.result.values[id] ?? null,
          status,
        };
      }
      const run: ExperimentRun = {
        id: makeRunId(),
        timestamp: Date.now(),
        experiment_id: currentTab.id,
        inputs,
        outputs,
        ...(out.error ? { error: out.error } : {}),
      };
      setRuns((prev) => [...prev, run]);
      setLastError(out.error ?? null);
    });
  }, [currentTab, varValues, labId]);

  const clearHistory = useCallback(() => {
    setRuns([]);
    setLastError(null);
  }, []);

  const doneExploring = useCallback(() => {
    const summary: InvestigationSummary = {
      runs,
      completed_at: Date.now(),
    };
    setResponse("investigation", JSON.stringify(summary));
    submitPhase("investigation");
    const next = UNLOCK_NEXT.investigation;
    if (next) router.push(`/lab/${labId}/phases/${next}`);
  }, [runs, setResponse, submitPhase, router, labId]);

  const inputVars = investigation.explorable_variables
    .map((id) => varsById.get(id))
    .filter((v): v is Variable => Boolean(v));
  const outputVars = variables.filter(
    (v) => v.role === "output" || v.role === "derived",
  );

  const experimentsForFilter = tabs.map((t) => ({ id: t.id, label: t.label }));

  /* ---- Gate status for the current tab ---- */
  const currentItem = itemForTab(currentTab.id);
  const currentPrediction = currentItem
    ? predictions[currentItem.id] ?? initialPredictionState()
    : undefined;
  const allPredictionsDone =
    !gate || prediction!.items.every((i) => isRunUnlocked(predictions[i.id]));
  // Free exploration would show every output, so it opens only once every
  // gated prediction has been committed and revised.
  const freeLocked = currentTab.id === FREE_EXPLORATION_ID && !allPredictionsDone;
  const tabLocked = currentItem !== undefined && !isRunUnlocked(currentPrediction);
  const runLocked = tabLocked || freeLocked;
  // With a live stage, releasing a slider runs the engine — unless the
  // prediction gate still holds this tab.
  const autoRun = stage !== undefined && !runLocked;
  // The stage draws the latest run, but stays idle on a locked tab so it
  // can't show a reading before the student has predicted it.
  const stageOutputs = runLocked ? null : runs[runs.length - 1]?.outputs ?? null;

  const commitPrediction = useCallback(() => {
    if (!currentItem || currentPrediction?.stage !== "choosing") return;
    const optionId = currentPrediction.selected;
    if (!optionId) return;
    const itemId = currentItem.id;
    setPredError(null);
    startPredTransition(async () => {
      const r = await resolvePrediction({ lab_id: labId, item_id: itemId, option_id: optionId });
      if (!r.ok) {
        setPredError(r.error);
        return;
      }
      dispatchPrediction(itemId, { type: "resolved", resolution: r.resolution });
      // The resolving run is a real engine run: record it in the history
      // and move the controls to the preset it ran at.
      setRuns((prev) => [
        ...prev,
        {
          id: makeRunId(),
          timestamp: Date.now(),
          experiment_id: r.resolution.experiment_id,
          inputs: r.resolution.inputs,
          outputs: r.resolution.outputs,
        },
      ]);
      setVarValues((prev) => ({ ...prev, ...r.resolution.inputs }));
      setLastError(null);
    });
  }, [currentItem, currentPrediction, labId, dispatchPrediction]);

  const answerRevision = useCallback(
    (step: RevisionStep, text: string) => {
      if (!currentItem || currentPrediction?.stage !== "resolved") return;
      const itemId = currentItem.id;
      const { resolution } = currentPrediction;
      dispatchPrediction(itemId, { type: "answer", step, text });
      if (step !== "revise" || !resolution.revision?.has_teacher_model || text.trim() === "") return;
      setPredError(null);
      startPredTransition(async () => {
        const r = await revealAlternativeModel({
          lab_id: labId,
          item_id: itemId,
          option_id: resolution.chosen_option_id,
          revise_text: text,
        });
        if (!r.ok) {
          setPredError(r.error);
          return;
        }
        dispatchPrediction(itemId, { type: "alternative_model", text: r.text });
      });
    },
    [currentItem, currentPrediction, labId, dispatchPrediction],
  );

  const canFinish = runs.length >= 1 && allPredictionsDone;

  return (
    <div className="space-y-5">
      {/* Tab list */}
      <div
        role="tablist"
        aria-label="Experiments"
        className="flex flex-wrap items-center gap-1.5 border-b border-surface-border pb-2"
      >
        {tabs.map((t) => {
          const isFree = t.id === FREE_EXPLORATION_ID;
          const selected = t.id === activeTab;
          const Icon = isFree ? Compass : Beaker;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setActiveTab(t.id);
                setLastError(null);
                setPredError(null);
                setConstantsOpen(false);
                // A still-locked gated tab shows its preset — the
                // configuration the prediction is about.
                const item = itemForTab(t.id);
                const preset = presetFor(t.id);
                if (item && preset && !isRunUnlocked(predictions[item.id])) {
                  setVarValues((prev) => ({ ...prev, ...preset }));
                }
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition",
                selected
                  ? "bg-accent text-text-inverse border-accent"
                  : "bg-surface text-text border-surface-border hover:bg-surface-muted",
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {currentTab.goal && (
        <div className="rounded-md border border-surface-border bg-surface-muted px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Goal
          </div>
          <p className="mt-1 text-sm text-text">{currentTab.goal}</p>
        </div>
      )}

      {/* Prediction gate (schema v2) */}
      {currentItem && currentPrediction && (
        <PredictionPanel
          item={currentItem}
          state={currentPrediction}
          variables={variables}
          measured={currentTab.measured}
          pending={predPending}
          error={predError}
          onSelect={(optionId) =>
            dispatchPrediction(currentItem.id, { type: "select", option_id: optionId })
          }
          onCommit={commitPrediction}
          onAnswer={answerRevision}
        />
      )}
      {freeLocked && (
        <div className="flex items-start gap-2 rounded-md border border-surface-border bg-surface-muted px-4 py-3 text-sm text-text-muted">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          Free exploration opens once you have made and checked a prediction in each experiment tab.
        </div>
      )}

      {/* Live stage — draws engine outputs only */}
      {stage === "series_circuit" && (
        <div className="space-y-1.5">
          <CircuitStage {...circuitStagePropsFromRun(stageOutputs, variables)} />
          <p className="text-xs text-text-soft">
            {runLocked
              ? "The circuit lights up once you have made your prediction."
              : "Release a slider to run the circuit. Every reading comes from the lab's engine."}
          </p>
        </div>
      )}

      {/* Controls area */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
            {currentTab.id === FREE_EXPLORATION_ID
              ? "All variables"
              : "Change these"}
          </div>
          <div className="space-y-4">
            {currentTab.manipulated.map((id) => {
              const v = varsById.get(id);
              if (!v) return null;
              return (
                <VariableControl
                  key={id}
                  variable={v}
                  value={varValues[id]}
                  onChange={(nv) => setValue(id, nv)}
                  onCommit={autoRun ? (nv) => runNow({ [id]: nv }) : undefined}
                  disabled={pending || runLocked}
                />
              );
            })}
          </div>
        </div>

        {currentTab.controlled.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Held constant
              </div>
              <button
                type="button"
                onClick={() => setConstantsOpen((v) => !v)}
                disabled={pending || runLocked}
                className={cn(
                  "inline-flex items-center gap-1 text-xs text-accent-strong hover:text-accent transition",
                  (pending || runLocked) && "opacity-50 cursor-not-allowed",
                )}
                aria-expanded={constantsOpen}
              >
                <Settings2 className="w-3.5 h-3.5" />
                {constantsOpen ? "Done" : "Set constants"}
                {constantsOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            {constantsOpen ? (
              <div className="space-y-4 rounded-md border border-accent/30 bg-accent-muted/40 p-3">
                <p className="text-xs text-text-muted">
                  These values are held constant while you run this experiment.
                  Set them once — they persist across tabs.
                </p>
                {currentTab.controlled.map((id) => {
                  const v = varsById.get(id);
                  if (!v) return null;
                  return (
                    <VariableControl
                      key={id}
                      variable={v}
                      value={varValues[id]}
                      onChange={(nv) => setValue(id, nv)}
                      onCommit={autoRun ? (nv) => runNow({ [id]: nv }) : undefined}
                      disabled={pending || runLocked}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {currentTab.controlled.map((id) => {
                  const v = varsById.get(id);
                  if (!v) return null;
                  return (
                    <VariableReadonly
                      key={id}
                      variable={v}
                      value={varValues[id]}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Run button + counts */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-text-soft">
          {runs.length === 0 ? (
            "No runs yet"
          ) : (
            <>
              {runs.length} run{runs.length === 1 ? "" : "s"} recorded
              <Badge variant="muted" className="ml-2">
                this tab: {runs.filter((r) => r.experiment_id === currentTab.id).length}
              </Badge>
            </>
          )}
        </div>
        <Button onClick={() => runNow()} disabled={pending || runLocked}>
          {runLocked ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {pending ? "Running…" : runLocked ? "Predict first" : "Run experiment"}
        </Button>
      </div>

      {/* Results */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
          Results — most recent {currentTab.label} run
        </div>
        <ResultsPanel
          variables={variables}
          varsToShow={currentTab.measured}
          outputs={lastRunForTab?.outputs ?? null}
          error={lastError}
        />
      </div>

      {/* History */}
      <RunHistoryTable
        runs={runs}
        inputVars={inputVars}
        outputVars={outputVars}
        experiments={experimentsForFilter}
        filter={historyFilter}
        onFilterChange={setHistoryFilter}
        onClear={clearHistory}
        disabled={pending}
      />

      {/* Done bar */}
      <div className="mt-6 rounded-lg border border-surface-border bg-surface p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">
              {investigationCompleted ? "Already submitted" : "Finished exploring?"}
            </div>
            <p className="mt-0.5 text-xs text-text-muted">
              {investigationCompleted
                ? "You've submitted your data history for this lab. Re-submitting will overwrite it with the current runs."
                : canFinish
                  ? `You've recorded ${runs.length} run${runs.length === 1 ? "" : "s"}. When you're done, submit to unlock Analysis.`
                  : !allPredictionsDone
                    ? "Make and check a prediction in each experiment tab before finishing."
                    : "Run at least one experiment before finishing."}
            </p>
          </div>
          <Button
            onClick={doneExploring}
            disabled={!canFinish || pending}
            data-testid="done-exploring"
          >
            {investigationCompleted ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Re-submit
              </>
            ) : (
              <>
                I'm done exploring
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
