/**
 * Class 10 Electricity — "Where does the current go?" (T3).
 *
 * Golden tests: hand-checked values from CLAUDE.md §9, written before the
 * spec. If one fails, the spec's science is wrong — fix the spec, never
 * the expected value.
 *
 * Also checks that the spec passes the v2 validator (V1–V7), that the two
 * misconception predictions hold across the whole input range, and that
 * the lab needed no engine code change (it loads through the same loader
 * and runs on the same runLab as the v1 specs).
 */

import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import * as fs from "node:fs";
import * as path from "node:path";
import { runLab } from "../src/engine/rule-engine";
import { parseLabSpec } from "../src/loader/spec-loader";
import { validateSpec } from "../src/validator/spec-validator";
import { labExists } from "../src/app/lib/get-lab-spec";
import { loadSpec, REPO_ROOT, CLASS_10_PATH } from "./helpers";

const DIGITS = 10;

describe("electricity — golden tests (hand-checked)", () => {
  const spec = loadSpec(CLASS_10_PATH);

  it("v=6, r1=10, r2=10 → r_series=20, i=0.3 A, v1=v2=3 V, p1=p2=0.9 W", () => {
    const r = runLab(spec, { v: 6, r1: 10, r2: 10 });
    expect(r.values.r_series).toBeCloseTo(20, DIGITS);
    expect(r.values.i_series).toBeCloseTo(0.3, DIGITS);
    expect(r.values.i_before_bulb1).toBeCloseTo(0.3, DIGITS);
    expect(r.values.i_after_bulb1).toBeCloseTo(0.3, DIGITS);
    expect(r.values.v1).toBeCloseTo(3, DIGITS);
    expect(r.values.v2).toBeCloseTo(3, DIGITS);
    expect(r.values.p1).toBeCloseTo(0.9, DIGITS);
    expect(r.values.p2).toBeCloseTo(0.9, DIGITS);
  });

  it("v=6, r1=10, r2=20 → r_series=30, i=0.2 A, v1=2 V, v2=4 V, p1=0.4 W, p2=0.8 W", () => {
    const r = runLab(spec, { v: 6, r1: 10, r2: 20 });
    expect(r.values.r_series).toBeCloseTo(30, DIGITS);
    expect(r.values.i_series).toBeCloseTo(0.2, DIGITS);
    expect(r.values.v1).toBeCloseTo(2, DIGITS);
    expect(r.values.v2).toBeCloseTo(4, DIGITS);
    expect(r.values.p1).toBeCloseTo(0.4, DIGITS);
    expect(r.values.p2).toBeCloseTo(0.8, DIGITS);
  });

  it("v=6, r1=10 alone → i_single=0.6 A; with r2=10 added → i_series=0.3 A", () => {
    const r = runLab(spec, { v: 6, r1: 10, r2: 10 });
    expect(r.values.i_single).toBeCloseTo(0.6, DIGITS);
    expect(r.values.i_series).toBeCloseTo(0.3, DIGITS);
  });

  it("every computed value is defined at the golden points (no undefined outputs)", () => {
    for (const inputs of [
      { v: 6, r1: 10, r2: 10 },
      { v: 6, r1: 10, r2: 20 },
    ]) {
      const r = runLab(spec, inputs);
      for (const [id, status] of Object.entries(r.status)) {
        expect(status, id).toBe("defined");
      }
    }
  });
});

describe("electricity — the physics behind M1 and M2 holds across the range", () => {
  const spec = loadSpec(CLASS_10_PATH);
  // Range corners plus a few uneven interior points.
  const points = [
    { v: 1.5, r1: 5, r2: 5 },
    { v: 1.5, r1: 50, r2: 5 },
    { v: 12, r1: 5, r2: 50 },
    { v: 12, r1: 50, r2: 50 },
    { v: 4.5, r1: 7, r2: 33 },
    { v: 9, r1: 41, r2: 12 },
  ];

  it("M1: the ammeter after bulb 1 reads the same as before it, for any v, r1, r2", () => {
    for (const p of points) {
      const r = runLab(spec, p);
      expect(r.values.i_after_bulb1, JSON.stringify(p)).toBe(r.values.i_before_bulb1);
    }
  });

  it("M2: adding bulb 2 always lowers the battery current", () => {
    for (const p of points) {
      const r = runLab(spec, p);
      expect(r.values.i_series as number, JSON.stringify(p)).toBeLessThan(
        r.values.i_single as number,
      );
    }
  });

  it("energy bookkeeping: v1 + v2 = v and p1 + p2 = v × i_series", () => {
    for (const p of points) {
      const r = runLab(spec, p);
      const v1 = r.values.v1 as number;
      const v2 = r.values.v2 as number;
      const i = r.values.i_series as number;
      expect(v1 + v2).toBeCloseTo(p.v, DIGITS);
      expect((r.values.p1 as number) + (r.values.p2 as number)).toBeCloseTo(p.v * i, DIGITS);
    }
  });
});

describe("electricity — spec structure", () => {
  const spec = loadSpec(CLASS_10_PATH);

  it("is a Class 10 physics lab, discoverable by the app", () => {
    expect(spec.meta.ncert_class).toBe(10);
    expect(spec.meta.subject).toBe("physics");
    expect(labExists("class-10-physics-electricity")).toBe(true);
  });

  it("targets the 35-minute period", () => {
    expect(spec.meta.estimated_duration_minutes).toBeLessThanOrEqual(35);
  });

  it("declares both misconceptions, a choice-mode prediction gate, and validity bounds", () => {
    expect(spec.misconceptions?.map((m) => m.id).sort()).toEqual([
      "m_battery_constant_current",
      "m_current_used_up",
    ]);
    expect(spec.prediction?.gate).toBe(true);
    expect(spec.prediction?.input_mode).toBe("choice");
    expect(spec.science_model.validity_bounds?.length).toBeGreaterThan(0);
  });

  it("M1 asks about current, not brightness", () => {
    const m1 = spec.misconceptions!.find((m) => m.id === "m_current_used_up")!;
    const item = spec.prediction!.items.find((i) =>
      i.options.some((o) => o.id === m1.detected_when.prediction_option),
    )!;
    for (const o of item.options) {
      expect(o.correct_when).not.toMatch(/\bp[12]\b/);
      expect(o.correct_when).toMatch(/i_after_bulb1/);
    }
  });

  it("passes the v2 validator (V1–V7) with no issues", () => {
    expect(validateSpec(spec, { samples: 256 })).toEqual([]);
  });

  it("the same lab asked about brightness instead would fail V4 (validator catches it on the real spec)", () => {
    const raw = yaml.load(
      fs.readFileSync(path.join(REPO_ROOT, CLASS_10_PATH), "utf8"),
    ) as { prediction: { items: Array<{ options: Array<{ correct_when: string }> }> } };
    const m1Options = raw.prediction.items[0]!.options;
    m1Options[0]!.correct_when = "p2 < p1"; // "less after the bulb" → "bulb 2 dimmer"
    m1Options[1]!.correct_when = "p2 == p1";
    m1Options[2]!.correct_when = "p2 > p1";
    const issues = validateSpec(parseLabSpec(yaml.dump(raw), "brightness-variant", { runSpecValidator: false }));
    expect(issues.map((i) => i.rule)).toEqual(["V4"]);
  });
});
