/**
 * CircuitStage (T6) — the series-circuit visual for the Class 10 lab.
 *
 * Rule under test (CLAUDE.md §8.4): visual components draw engine outputs
 * only; no physics or maths in UI code. The stage receives readings and
 * draws them. It must never recompute, correct, or clamp a reading — so
 * feeding it physically absurd values must show those values unchanged.
 */

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CircuitStage,
  type CircuitStageProps,
} from "../src/components/stage/circuit-stage";
import {
  flowDurationSeconds,
  formatReading,
  glowLevel,
} from "../src/components/stage/stage-encoding";
import { circuitStagePropsFromRun } from "../src/components/stage/circuit-stage-adapter";
import type { RunOutput } from "../src/app/lib/experiment-run";
import { runLab } from "../src/engine/rule-engine";
import { loadSpec, CLASS_10_PATH } from "./helpers";

const SCALES = { powerScaleMax: 10, currentScaleMax: 3 };

function render(props: CircuitStageProps): string {
  return renderToStaticMarkup(createElement(CircuitStage, props));
}

/** Pull `data-<name>` values for each element carrying `data-part="<part>"`. */
function attr(html: string, part: string, name: string): string | null {
  const re = new RegExp(`data-part="${part}"[^>]*data-${name}="([^"]*)"`);
  return re.exec(html)?.[1] ?? null;
}

/** Visible text of the element carrying `data-part="<part>"`. */
function text(html: string, part: string): string | null {
  const re = new RegExp(`data-part="${part}"[^>]*>([^<]*)<`);
  return re.exec(html)?.[1] ?? null;
}

/* ------------------------------------------------------------------ */
/* The required test: absurd but consistent outputs shown unchanged     */
/* ------------------------------------------------------------------ */

describe("CircuitStage — shows engine outputs unchanged", () => {
  it("absurd but consistent outputs (1000 V, 50 A, 25000 W each) are displayed exactly", () => {
    // Consistent with r1 = r2 = 10 Ω: I = 1000 / 20 = 50 A, P = 50² × 10.
    // Physically absurd for a school circuit, and far outside the display
    // scales. The stage must neither recompute nor clamp the readings.
    const html = render({
      batteryVoltage: 1000,
      ammeterBefore: 50,
      ammeterAfter: 50,
      bulb1Power: 25000,
      bulb2Power: 25000,
      current: 50,
      ...SCALES,
    });
    expect(text(html, "battery-label")).toBe("1000 V");
    expect(text(html, "ammeter-before-reading")).toBe("50 A");
    expect(text(html, "ammeter-after-reading")).toBe("50 A");
    expect(text(html, "bulb1-power")).toBe("25000 W");
    expect(text(html, "bulb2-power")).toBe("25000 W");
    // Visual encodings may saturate; the numbers may not.
    expect(attr(html, "bulb1-glow", "glow")).toBe("1");
    expect(attr(html, "bulb2-glow", "glow")).toBe("1");
  });

  it("does not 'correct' readings that break physics (before ≠ after in series)", () => {
    // A real series circuit can't do this. If the UI held any physics it
    // might equalise them; it must show exactly what it was given.
    const html = render({
      batteryVoltage: 6,
      ammeterBefore: 0.3,
      ammeterAfter: 0.1,
      bulb1Power: 0.9,
      bulb2Power: 0.0123,
      current: 0.3,
      ...SCALES,
    });
    expect(text(html, "ammeter-before-reading")).toBe("0.3 A");
    expect(text(html, "ammeter-after-reading")).toBe("0.1 A");
    expect(text(html, "bulb2-power")).toBe("0.0123 W");
  });

  it("with no run yet: readings show a dash, bulbs are dark, nothing flows", () => {
    const html = render({
      batteryVoltage: null,
      ammeterBefore: null,
      ammeterAfter: null,
      bulb1Power: null,
      bulb2Power: null,
      current: null,
      ...SCALES,
    });
    expect(text(html, "battery-label")).toBe("—");
    expect(text(html, "ammeter-before-reading")).toBe("—");
    expect(text(html, "ammeter-after-reading")).toBe("—");
    expect(attr(html, "bulb1-glow", "glow")).toBe("0");
    expect(html).not.toContain('data-part="flow-dot"');
  });

  it("the brighter bulb is the one given more power, and more current means faster flow", () => {
    const html = render({
      batteryVoltage: 6, ammeterBefore: 0.2, ammeterAfter: 0.2,
      bulb1Power: 0.4, bulb2Power: 0.8, current: 0.2, ...SCALES,
    });
    expect(Number(attr(html, "bulb2-glow", "glow"))).toBeGreaterThan(
      Number(attr(html, "bulb1-glow", "glow")),
    );
    const slow = render({ batteryVoltage: 6, ammeterBefore: 0.2, ammeterAfter: 0.2, bulb1Power: 0.4, bulb2Power: 0.8, current: 0.2, ...SCALES });
    const fast = render({ batteryVoltage: 12, ammeterBefore: 1.2, ammeterAfter: 1.2, bulb1Power: 7.2, bulb2Power: 7.2, current: 1.2, ...SCALES });
    expect(Number(attr(fast, "flow", "duration"))).toBeLessThan(Number(attr(slow, "flow", "duration")));
  });
});

/* ------------------------------------------------------------------ */
/* Visual encodings — display mapping only                              */
/* ------------------------------------------------------------------ */

describe("stage encodings", () => {
  it("formatReading leaves values unchanged up to 4 decimals and dashes null", () => {
    expect(formatReading(50)).toBe("50");
    expect(formatReading(0.3)).toBe("0.3");
    expect(formatReading(0.0123)).toBe("0.0123");
    expect(formatReading(0.30000000000000004)).toBe("0.3");
    expect(formatReading(null)).toBe("—");
  });

  it("glowLevel is value / scale, held to [0, 1]", () => {
    expect(glowLevel(null, 10)).toBe(0);
    expect(glowLevel(0, 10)).toBe(0);
    expect(glowLevel(5, 10)).toBe(0.5);
    expect(glowLevel(25000, 10)).toBe(1);
    expect(glowLevel(-1, 10)).toBe(0);
  });

  it("flowDurationSeconds: no flow at zero or null current; faster with more current; bounded", () => {
    expect(flowDurationSeconds(null, 3)).toBeNull();
    expect(flowDurationSeconds(0, 3)).toBeNull();
    const a = flowDurationSeconds(0.3, 3)!;
    const b = flowDurationSeconds(0.6, 3)!;
    expect(b).toBeLessThan(a);
    expect(flowDurationSeconds(50, 3)).toBeGreaterThan(0);
    expect(flowDurationSeconds(1e-9, 3)).toBeLessThan(Infinity);
  });
});

/* ------------------------------------------------------------------ */
/* Adapter — picks engine values, never recomputes                      */
/* ------------------------------------------------------------------ */

describe("circuitStagePropsFromRun", () => {
  const spec = loadSpec(CLASS_10_PATH);

  function outputsOf(inputs: Record<string, number>): Record<string, RunOutput> {
    const r = runLab(spec, inputs);
    const out: Record<string, RunOutput> = {};
    for (const [id, status] of Object.entries(r.status)) {
      out[id] = { value: r.values[id] ?? null, status };
    }
    return out;
  }

  it("passes the engine's values through exactly (golden case v=6, r1=10, r2=20)", () => {
    const outputs = outputsOf({ v: 6, r1: 10, r2: 20 });
    const p = circuitStagePropsFromRun(outputs, spec.science_model.variables);
    expect(p.batteryVoltage).toBe(outputs.v!.value);
    expect(p.ammeterBefore).toBe(outputs.i_before_bulb1!.value);
    expect(p.ammeterAfter).toBe(outputs.i_after_bulb1!.value);
    expect(p.bulb1Power).toBe(outputs.p1!.value);
    expect(p.bulb2Power).toBe(outputs.p2!.value);
    expect(p.current).toBe(outputs.i_series!.value);
  });

  it("takes display scales from the declared variable ranges", () => {
    const p = circuitStagePropsFromRun(null, spec.science_model.variables);
    const range = (id: string) => spec.science_model.variables.find((v) => v.id === id)!.range![1];
    expect(p.powerScaleMax).toBe(range("p1"));
    expect(p.currentScaleMax).toBe(range("i_series"));
  });

  it("maps undefined or missing outputs to null, never to a number", () => {
    const p = circuitStagePropsFromRun(
      { p1: { value: null, status: "undefined" }, i_series: { value: 0.3, status: "defined" } },
      spec.science_model.variables,
    );
    expect(p.bulb1Power).toBeNull();
    expect(p.ammeterBefore).toBeNull();
    expect(p.current).toBe(0.3);
  });

  it("no run → all readings null", () => {
    const p = circuitStagePropsFromRun(null, spec.science_model.variables);
    expect([p.batteryVoltage, p.ammeterBefore, p.ammeterAfter, p.bulb1Power, p.bulb2Power, p.current])
      .toEqual([null, null, null, null, null, null]);
  });
});
