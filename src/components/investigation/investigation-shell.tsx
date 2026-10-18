"use client";

/**
 * Investigation phase — sim-first layout.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │ Toolbar: experiment tabs + run count + done  │
 *   ├────────────────────────┬────────────────────┤
 *   │                        │  Controls panel     │
 *   │   Simulation stage     │  - Prediction gate  │
 *   │   (circuit / generic)  │  - Sliders          │
 *   │                        │  - Constants        │
 *   │                        │  - Quick results    │
 *   ├────────────────────────┴────────────────────┤
 *   │ Data drawer (collapsible)                    │
 *   │  Graph · Results table · Run history         │
 *   └─────────────────────────────────────────────┘
 */

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Beaker,
  Compass,
  Settings2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Lock,
  BarChart3,
  Table2,
} from "lucide-react";

import type { Investigation, PublicPrediction, Variable, ScaffoldingLevel } from "@/schema/lab-spec";
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
import { RunGraph } from "./run-graph";
import {
  defaultAxes,
  graphPoints,
  numericInputs,
  numericOutputs,
  type AxisChoice,
} from "./run-graph-data";
import { PredictionPanel } from "./prediction-panel";
import { CircuitStage } from "@/components/stage/circuit-stage";
import { circuitStagePropsFromRun } from "@/components/stage/circuit-stage-adapter";
import type { StageKind } from "@/components/stage/stage-registry";

interface Props {
  labId: string;
  investigation: Investigation;
  variables: Variable[];
  prediction?: PublicPrediction | undefined;
  stage?: StageKind | undefined;
  scaffoldingLevel?: ScaffoldingLevel;
}

interface TabSpec {
  id: string;
  label: string;
  goal?: string;
  controlled: string[];
  manipulated: string[];
  measured: string[];
}

type DrawerTab = "graph" | "results" | "history";

export function InvestigationShell({ labId, investigation, variables, prediction, stage, scaffoldingLevel }: Props) {
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
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("graph");

  /* ---- Prediction gate (schema v2) ---- */
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
  const [axesByTab, setAxesByTab] = useState<Record<string, AxisChoice>>({});
  const [expectationDraft, setExpectationDraft] = useState<Record<string, string>>({});
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
    const tabAxes =
      axesByTab[currentTab.id] ??
      defaultAxes(currentTab, variables, investigation.explorable_variables);
    const draft = expectationDraft[currentTab.id]?.trim() ?? "";
    const expectedValue = draft === "" ? NaN : Number(draft);
    const expectation =
      tabAxes && Number.isFinite(expectedValue)
        ? { y_variable: tabAxes.y, value: expectedValue }
        : undefined;
    if (expectation) {
      setExpectationDraft((prev) => ({ ...prev, [currentTab.id]: "" }));
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
        ...(expectation ? { expectation } : {}),
      };
      setRuns((prev) => [...prev, run]);
      setLastError(out.error ?? null);
      if (!drawerOpen && runs.length === 0) setDrawerOpen(true);
    });
  }, [currentTab, varValues, labId, axesByTab, expectationDraft, variables, investigation, drawerOpen, runs.length]);

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
  const freeLocked = currentTab.id === FREE_EXPLORATION_ID && !allPredictionsDone;
  const tabLocked = currentItem !== undefined && !isRunUnlocked(currentPrediction);
  const runLocked = tabLocked || freeLocked;
  const autoRun = !runLocked;

  /* ---- Live run graph ---- */
  const tabDefaultAxes = defaultAxes(currentTab, variables, investigation.explorable_variables);
  const axes = axesByTab[currentTab.id] ?? tabDefaultAxes;
  const xVar = axes ? varsById.get(axes.x) : undefined;
  const yVar = axes ? varsById.get(axes.y) : undefined;
  const points = axes ? graphPoints(runs, currentTab.id, axes.x, axes.y) : [];
  const setAxis = (which: "x" | "y", id: string) => {
    if (!axes) return;
    setAxesByTab((prev) => ({ ...prev, [currentTab.id]: { ...axes, [which]: id } }));
  };
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
      setDrawerOpen(true);
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
  const tabRunCount = runs.filter((r) => r.experiment_id === currentTab.id).length;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ═══════ Toolbar ═══════ */}
      <div className="shrink-0 bg-surface border-b border-surface-border px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <div
            role="tablist"
            aria-label="Experiments"
            className="flex items-center gap-1.5"
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
                    const item = itemForTab(t.id);
                    const preset = presetFor(t.id);
                    if (item && preset && !isRunUnlocked(predictions[item.id])) {
                      setVarValues((prev) => ({ ...prev, ...preset }));
                    }
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition whitespace-nowrap",
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
          {runs.length > 0 && (
            <span className="text-xs text-text-soft whitespace-nowrap ml-2">
              {runs.length} run{runs.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDrawerOpen((v) => !v)}
            className="text-xs gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Data
            {drawerOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </Button>
          <Button
            size="sm"
            onClick={doneExploring}
            disabled={!canFinish || pending}
            data-testid="done-exploring"
            className="text-xs"
          >
            {investigationCompleted ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Re-submit
              </>
            ) : (
              <>
                Done exploring
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ═══════ Main area: simulation + controls ═══════ */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-y-auto">
        {/* ── Simulation canvas ── */}
        <div className="flex-1 min-w-0 p-4 flex flex-col">
          {/* Goal banner */}
          {currentTab.goal && (
            <div className="rounded-lg border border-surface-border bg-surface px-4 py-2.5 mb-3">
              <p className="text-sm text-text">
                <span className="font-semibold text-accent-strong">Goal: </span>
                {currentTab.goal}
              </p>
            </div>
          )}

          {/* Prediction gate */}
          {currentItem && currentPrediction && (
            <div className="mb-3">
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
            </div>
          )}
          {freeLocked && (
            <div className="flex items-start gap-2 rounded-lg border border-surface-border bg-surface-muted px-4 py-3 text-sm text-text-muted mb-3">
              <Lock className="w-4 h-4 mt-0.5 shrink-0" />
              Free exploration opens once you have made and checked a prediction in each experiment tab.
            </div>
          )}

          {/* Stage visual — takes remaining space */}
          {stage === "series_circuit" ? (
            <div className="flex-1 flex items-center justify-center min-h-[280px]">
              <div className="w-full max-w-2xl">
                <CircuitStage {...circuitStagePropsFromRun(stageOutputs, variables)} />
                <p className="text-xs text-text-soft text-center mt-2">
                  {runLocked
                    ? "The circuit lights up once you have made your prediction."
                    : "Drag a slider to run the circuit. Every reading comes from the engine."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center min-h-[200px] rounded-lg border-2 border-dashed border-surface-border">
              <div className="text-center text-text-soft">
                <Beaker className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">
                  {runLocked ? "Make your prediction to start." : "Change a value to run the experiment."}
                </p>
                {!runLocked && (
                  <Button
                    onClick={() => runNow()}
                    disabled={pending}
                    className="mt-3"
                    size="sm"
                  >
                    <Play className="w-4 h-4" />
                    Run experiment
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Controls panel (right sidebar) ── */}
        <div className="md:w-72 xl:w-80 shrink-0 border-t md:border-t-0 md:border-l border-surface-border bg-surface overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Scaffolding badge */}
            {scaffoldingLevel && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Controls</span>
                <Badge variant="muted" className="text-[10px]">
                  {scaffoldingLevel} support
                </Badge>
              </div>
            )}

            {/* Manipulated variables */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                {currentTab.id === FREE_EXPLORATION_ID ? "All variables" : "Change these"}
              </div>
              <div className="space-y-3">
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
                      disabled={runLocked}
                    />
                  );
                })}
              </div>
            </div>

            {/* Controlled variables */}
            {currentTab.controlled.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Held constant
                  </div>
                  <button
                    type="button"
                    onClick={() => setConstantsOpen((v) => !v)}
                    disabled={runLocked}
                    className={cn(
                      "inline-flex items-center gap-1 text-xs text-accent-strong hover:text-accent transition",
                      runLocked && "opacity-50 cursor-not-allowed",
                    )}
                    aria-expanded={constantsOpen}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    {constantsOpen ? "Done" : "Edit"}
                    {constantsOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {constantsOpen ? (
                  <div className="space-y-3 rounded-lg border border-accent/30 bg-accent-muted/40 p-3">
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
                          disabled={runLocked}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1.5">
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

            {/* Run button */}
            <div className="pt-2 border-t border-surface-border">
              <Button
                onClick={() => runNow()}
                disabled={pending || runLocked}
                className="w-full"
                size="sm"
              >
                {runLocked ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {pending ? "Running…" : runLocked ? "Predict first" : "Run experiment"}
              </Button>
              <p className="text-[11px] text-text-soft text-center mt-1.5">
                {runs.length === 0
                  ? runLocked ? "" : "or drag a slider"
                  : `${tabRunCount} run${tabRunCount === 1 ? "" : "s"} this experiment`}
              </p>
            </div>

            {/* Quick results — latest run for this tab */}
            {lastRunForTab && (
              <div className="pt-2 border-t border-surface-border">
                <div className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                  Latest reading
                </div>
                <ResultsPanel
                  variables={variables}
                  varsToShow={currentTab.measured}
                  outputs={lastRunForTab.outputs}
                  error={lastError}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ Data drawer (collapsible) ═══════ */}
      {drawerOpen && (
        <div className="shrink-0 border-t border-surface-border bg-surface">
          {/* Drawer tab bar */}
          <div className="flex items-center gap-1 px-4 pt-2 border-b border-surface-border">
            {([
              { id: "graph" as const, label: "Graph", Icon: BarChart3 },
              { id: "results" as const, label: "Results table", Icon: Table2 },
              { id: "history" as const, label: "Run history", Icon: Table2 },
            ]).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDrawerTab(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition -mb-px",
                  drawerTab === id
                    ? "border-accent text-accent"
                    : "border-transparent text-text-muted hover:text-text",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 max-h-[40vh] overflow-y-auto">
            {drawerTab === "graph" && axes && xVar && yVar && (
              <div className="space-y-2 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <label className="flex items-center gap-1">
                    y
                    <select
                      aria-label="Graph y-axis"
                      value={axes.y}
                      onChange={(e) => setAxis("y", e.target.value)}
                      className="rounded-md border border-surface-border bg-surface px-2 py-1 text-xs"
                    >
                      {numericOutputs(variables).map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    x
                    <select
                      aria-label="Graph x-axis"
                      value={axes.x}
                      onChange={(e) => setAxis("x", e.target.value)}
                      className="rounded-md border border-surface-border bg-surface px-2 py-1 text-xs"
                    >
                      {numericInputs(variables, investigation.explorable_variables).map((v) => (
                        <option key={v.id} value={v.id}>{v.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {!runLocked && (
                  <label className="flex flex-wrap items-center gap-2 rounded-md border border-surface-border bg-surface-muted px-3 py-2 text-xs text-text-muted">
                    <span>I expect {yVar.label} ≈</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      aria-label={`Expected ${yVar.label} for the next run`}
                      value={expectationDraft[currentTab.id] ?? ""}
                      onChange={(e) =>
                        setExpectationDraft((prev) => ({ ...prev, [currentTab.id]: e.target.value }))
                      }
                      className="w-24 rounded-md border border-surface-border bg-surface px-2 py-1 text-xs text-right"
                    />
                    {yVar.unit && <span>{yVar.unit}</span>}
                  </label>
                )}
                <RunGraph points={points} xVar={xVar} yVar={yVar} latestRunId={runs[runs.length - 1]?.id} />
              </div>
            )}
            {drawerTab === "graph" && !(axes && xVar && yVar) && (
              <p className="text-sm text-text-muted">Run an experiment to see the graph.</p>
            )}

            {drawerTab === "results" && (
              <div className="max-w-3xl">
                <ResultsPanel
                  variables={variables}
                  varsToShow={currentTab.measured}
                  outputs={lastRunForTab?.outputs ?? null}
                  error={lastError}
                />
              </div>
            )}

            {drawerTab === "history" && (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
