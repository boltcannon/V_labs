/**
 * Live run graph (interactivity, option 1).
 *
 * The graph plots the student's own runs — engine outputs only. It draws
 * points, never a fitted line or curve (that would be the UI inventing a
 * relationship), and it shows every value exactly as the engine gave it.
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  axisDomain,
  defaultAxes,
  graphPoints,
  numericInputs,
  numericOutputs,
} from "../src/components/investigation/run-graph-data";
import { RunGraph } from "../src/components/investigation/run-graph";
import type { ExperimentRun } from "../src/app/lib/experiment-run";
import type { Variable } from "../src/schema/lab-spec";
import { loadSpec, CLASS_6_PATH, CLASS_9_PATH, CLASS_10_PATH } from "./helpers";

const c9 = loadSpec(CLASS_9_PATH);
const c9vars = c9.science_model.variables;
const tab = (id: string) => {
  const e = c9.investigation.experiments.find((x) => x.id === id)!;
  return { manipulated: e.manipulated_vars, measured: e.measured_vars };
};

function run(id: string, experiment_id: string, values: Record<string, number | null>): ExperimentRun {
  const outputs: ExperimentRun["outputs"] = {};
  for (const [k, v] of Object.entries(values)) {
    outputs[k] = { value: v, status: v === null ? "undefined" : "defined" };
  }
  return { id, timestamp: 0, experiment_id, inputs: {}, outputs };
}

/* ------------------------------------------------------------------ */
/* Axis choice                                                          */
/* ------------------------------------------------------------------ */

describe("run graph — axis choice", () => {
  it("x options are numeric explorable inputs; y options are numeric outputs/derived", () => {
    expect(numericInputs(c9vars, c9.investigation.explorable_variables).map((v) => v.id)).toEqual([
      "speed", "time", "leg1_distance", "leg1_time", "leg2_distance", "leg2_time",
    ]);
    expect(numericOutputs(c9vars).map((v) => v.id)).toEqual([
      "distance", "average_speed", "speed_leg1", "speed_leg2",
    ]);
  });

  it("defaults to the tab's first manipulated input and first measured output", () => {
    expect(defaultAxes(tab("uniform_baseline"), c9vars, c9.investigation.explorable_variables))
      .toEqual({ x: "speed", y: "distance" });
    expect(defaultAxes(tab("average_speed_puzzle"), c9vars, c9.investigation.explorable_variables))
      .toEqual({ x: "leg1_time", y: "average_speed" });
  });

  it("falls back to any numeric input/output when the tab has none (e.g. motion_class)", () => {
    expect(defaultAxes(tab("uniform_vs_nonuniform"), c9vars, c9.investigation.explorable_variables))
      .toEqual({ x: "leg1_distance", y: "distance" });
  });

  it("works for the electricity lab", () => {
    const c10 = loadSpec(CLASS_10_PATH);
    const e = c10.investigation.experiments[0]!;
    expect(defaultAxes(
      { manipulated: e.manipulated_vars, measured: e.measured_vars },
      c10.science_model.variables,
      c10.investigation.explorable_variables,
    )).toEqual({ x: "r1", y: "i_before_bulb1" });
  });

  it("returns null for a lab with no numeric variables (Class 6 biology)", () => {
    const c6 = loadSpec(CLASS_6_PATH);
    const e = c6.investigation.experiments[0]!;
    expect(defaultAxes(
      { manipulated: e.manipulated_vars, measured: e.measured_vars },
      c6.science_model.variables,
      c6.investigation.explorable_variables,
    )).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Points                                                               */
/* ------------------------------------------------------------------ */

describe("run graph — points", () => {
  const runs = [
    run("a", "uniform_baseline", { speed: 10, distance: 50 }),
    run("b", "average_speed_puzzle", { speed: 3, distance: 9 }),
    run("c", "uniform_baseline", { speed: 20, distance: null }),
    run("d", "uniform_baseline", { speed: 4, distance: 20 }),
  ];

  it("takes only the current tab's runs where both values are defined, numbered as in the history", () => {
    expect(graphPoints(runs, "uniform_baseline", "speed", "distance")).toEqual([
      { runId: "a", runNumber: 1, x: 10, y: 50 },
      { runId: "d", runNumber: 4, x: 4, y: 20 },
    ]);
  });

  it("passes values through exactly", () => {
    const pts = graphPoints([run("z", "t", { speed: 0.30000000000000004, distance: 1e6 })], "t", "speed", "distance");
    expect(pts[0]).toEqual({ runId: "z", runNumber: 1, x: 0.30000000000000004, y: 1e6 });
  });

  it("axisDomain starts at 0 (or below for negatives) and leaves headroom above the largest value", () => {
    expect(axisDomain([])).toEqual([0, 1]);
    expect(axisDomain([5])).toEqual([0, 5.5]);
    expect(axisDomain([2, 10])).toEqual([0, 11]);
    expect(axisDomain([-4, 6])).toEqual([-4, 7]);
    expect(axisDomain([0, 0])).toEqual([0, 1]);
  });
});

/* ------------------------------------------------------------------ */
/* Expected points (ungraded "ghost")                                   */
/* ------------------------------------------------------------------ */

describe("run graph — expected points", () => {
  const withExpectation = (r: ExperimentRun, y_variable: string, value: number): ExperimentRun => ({
    ...r,
    expectation: { y_variable, value },
  });

  it("a point carries the student's expectation when it was made for the plotted y variable", () => {
    const runs = [
      withExpectation(run("a", "t", { speed: 10, distance: 100 }), "distance", 80),
      withExpectation(run("b", "t", { speed: 5, distance: 50, average_speed: 5 }), "average_speed", 7),
      run("c", "t", { speed: 2, distance: 20 }),
    ];
    expect(graphPoints(runs, "t", "speed", "distance")).toEqual([
      { runId: "a", runNumber: 1, x: 10, y: 100, expected: 80 },
      { runId: "b", runNumber: 2, x: 5, y: 50 },
      { runId: "c", runNumber: 3, x: 2, y: 20 },
    ]);
  });

  it("draws a hollow ghost at the expected value with a dashed gap line to the real point", () => {
    const speed = c9vars.find((v) => v.id === "speed") as Variable;
    const distance = c9vars.find((v) => v.id === "distance") as Variable;
    const html = renderToStaticMarkup(createElement(RunGraph, {
      points: [
        { runId: "a", runNumber: 1, x: 10, y: 100, expected: 80 },
        { runId: "c", runNumber: 3, x: 2, y: 20 },
      ],
      xVar: speed,
      yVar: distance,
    }));
    expect(html.match(/data-part="expected"/g)).toHaveLength(1);
    expect(html.match(/data-part="gap"/g)).toHaveLength(1);
    expect(html).toContain("Run 1: you expected Distance covered = 80 m");
    // The real value is still shown exactly.
    expect(html).toContain("Run 1: Speed = 10 m/s, Distance covered = 100 m");
  });

  it("keeps an expected value inside the axis even when it is far above the real points", () => {
    const speed = c9vars.find((v) => v.id === "speed") as Variable;
    const distance = c9vars.find((v) => v.id === "distance") as Variable;
    const html = renderToStaticMarkup(createElement(RunGraph, {
      points: [{ runId: "a", runNumber: 1, x: 10, y: 10, expected: 1000 }],
      xVar: speed,
      yVar: distance,
    }));
    const cy = /data-part="expected"[^>]*>\s*<title>[^<]*<\/title>\s*<circle[^>]*cy="([^"]+)"/.exec(html)?.[1];
    expect(Number(cy)).toBeGreaterThanOrEqual(16); // PAD.top — on the plot, not above it
  });
});

/* ------------------------------------------------------------------ */
/* Release-to-run: which keys count as a slider release                 */
/* ------------------------------------------------------------------ */

describe("slider release keys", () => {
  it("arrow, Home/End and Page keys release; Tab and other keys do not", async () => {
    const { SLIDER_KEYS } = await import("../src/components/investigation/variable-control");
    for (const k of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]) {
      expect(SLIDER_KEYS.has(k), k).toBe(true);
    }
    // Tab's keyup lands on the slider that just received focus — it must
    // not commit that slider's (possibly stale) value as a run.
    for (const k of ["Tab", "Shift", "Enter", " "]) {
      expect(SLIDER_KEYS.has(k), k).toBe(false);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Rendering                                                            */
/* ------------------------------------------------------------------ */

describe("RunGraph — renders the runs, nothing else", () => {
  const speed = c9vars.find((v) => v.id === "speed") as Variable;
  const distance = c9vars.find((v) => v.id === "distance") as Variable;

  it("draws one point per run, labelled with the run number and exact values, and no connecting line", () => {
    const html = renderToStaticMarkup(createElement(RunGraph, {
      points: [
        { runId: "a", runNumber: 1, x: 10, y: 50 },
        { runId: "d", runNumber: 4, x: 4, y: 20 },
      ],
      xVar: speed,
      yVar: distance,
      latestRunId: "d",
    }));
    expect(html.match(/data-part="point"/g)).toHaveLength(2);
    expect(html).toContain("Run 1: Speed = 10 m/s, Distance covered = 50 m");
    expect(html).toContain("Run 4: Speed = 4 m/s, Distance covered = 20 m");
    expect(html).toContain('data-latest="true"');
    expect(html).toContain("Speed (m/s)");
    expect(html).toContain("Distance covered (m)");
    expect(html).not.toMatch(/<polyline|<path[^>]*data-part="fit"/);
  });

  it("shows absurd values unchanged", () => {
    const html = renderToStaticMarkup(createElement(RunGraph, {
      points: [{ runId: "x", runNumber: 7, x: 99999, y: -123.4567 }],
      xVar: speed,
      yVar: distance,
    }));
    expect(html).toContain("Run 7: Speed = 99999 m/s, Distance covered = -123.4567 m");
  });

  it("with no points, says how to get some", () => {
    const html = renderToStaticMarkup(createElement(RunGraph, { points: [], xVar: speed, yVar: distance }));
    expect(html).not.toContain('data-part="point"');
    expect(html).toContain("Run the experiment to plot a point");
  });
});
