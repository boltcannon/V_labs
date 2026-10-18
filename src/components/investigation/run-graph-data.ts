/**
 * Data selection for the live run graph. Pure functions, no React.
 *
 * The graph plots the student's own runs: each point is one engine run's
 * value for the x variable and the y variable, exactly as the engine
 * produced them. Nothing here computes science — it only chooses which
 * stored values to plot and how much axis room to give them.
 */

import type { Variable } from "@/schema/lab-spec";
import type { ExperimentRun } from "@/app/lib/experiment-run";

/** Numeric inputs the student can change — candidates for the x axis. */
export function numericInputs(variables: Variable[], explorable: string[]): Variable[] {
  return variables.filter(
    (v) => v.type === "number" && v.role === "input" && explorable.includes(v.id),
  );
}

/** Numeric values the engine computes — candidates for the y axis. */
export function numericOutputs(variables: Variable[]): Variable[] {
  return variables.filter(
    (v) => v.type === "number" && (v.role === "output" || v.role === "derived"),
  );
}

export interface AxisChoice {
  x: string;
  y: string;
}

/**
 * Default axes for a tab: the first numeric variable the tab manipulates
 * against the first numeric variable it measures, falling back to any
 * numeric input / output. `null` when the lab has no numeric pair to plot.
 */
export function defaultAxes(
  tab: { manipulated: string[]; measured: string[] },
  variables: Variable[],
  explorable: string[],
): AxisChoice | null {
  const xs = numericInputs(variables, explorable);
  const ys = numericOutputs(variables);
  const x = tab.manipulated.find((id) => xs.some((v) => v.id === id)) ?? xs[0]?.id;
  const y = tab.measured.find((id) => ys.some((v) => v.id === id)) ?? ys[0]?.id;
  return x && y ? { x, y } : null;
}

export interface GraphPoint {
  runId: string;
  /** 1-based position in the full run history, matching "Run N" elsewhere. */
  runNumber: number;
  x: number;
  y: number;
  /** The student's expected y for this run, if given for this y variable. */
  expected?: number;
}

/** The current tab's runs where the engine defined both values. */
export function graphPoints(
  runs: ExperimentRun[],
  tabId: string,
  x: string,
  y: string,
): GraphPoint[] {
  const out: GraphPoint[] = [];
  runs.forEach((run, i) => {
    if (run.experiment_id !== tabId) return;
    const ox = run.outputs[x];
    const oy = run.outputs[y];
    if (ox?.status !== "defined" || oy?.status !== "defined") return;
    if (typeof ox.value !== "number" || typeof oy.value !== "number") return;
    const exp = run.expectation?.y_variable === y ? run.expectation.value : undefined;
    out.push({
      runId: run.id,
      runNumber: i + 1,
      x: ox.value,
      y: oy.value,
      ...(exp !== undefined ? { expected: exp } : {}),
    });
  });
  return out;
}

/**
 * Axis range for a set of plotted values: from 0 (or the smallest value,
 * if negative) to the largest value plus 10% headroom.
 */
export function axisDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values);
  if (!(hi > lo)) return [lo, lo + 1];
  return [lo, hi + (hi - lo) * 0.1];
}
