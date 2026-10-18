/**
 * Tests for the Formula Pattern Library (Prompt 5, Checkpoint 2).
 *
 * Verifies:
 *   - instantiatePattern produces correct expression strings
 *   - Slot mapping validation (missing slots throw)
 *   - Threshold patterns require a threshold value
 *   - getPatternById returns correct patterns
 *   - All patterns have unique ids
 *   - Output slot identification
 */

import { describe, it, expect } from "vitest";

import {
  FORMULA_PATTERNS,
  instantiatePattern,
  getPatternById,
  type FormulaPattern,
} from "../src/app/lib/formula-patterns";

import {
  parseRuleExpression,
  evaluateExpression,
} from "../src/engine/expression-evaluator";

/* ------------------------------------------------------------------ */
/*  Pattern library integrity                                          */
/* ------------------------------------------------------------------ */

describe("FORMULA_PATTERNS", () => {
  it("has 9 patterns (7 from Decision 2 + 2 threshold variants)", () => {
    expect(FORMULA_PATTERNS.length).toBe(9);
  });

  it("every pattern has a unique id", () => {
    const ids = FORMULA_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every pattern has exactly one output slot", () => {
    for (const p of FORMULA_PATTERNS) {
      const outputs = p.slots.filter((s) => s.isOutput);
      expect(outputs).toHaveLength(1);
    }
  });

  it("includes a threshold pattern with outputIsBoolean", () => {
    const threshold = FORMULA_PATTERNS.find((p) => p.id === "threshold");
    expect(threshold).toBeDefined();
    expect(threshold!.outputIsBoolean).toBe(true);
  });

  it("includes the threshold_lte complement", () => {
    const lte = FORMULA_PATTERNS.find((p) => p.id === "threshold_lte");
    expect(lte).toBeDefined();
    expect(lte!.outputIsBoolean).toBe(true);
  });

  it("includes both_zero_check (used by Class 9 spec)", () => {
    const bz = FORMULA_PATTERNS.find((p) => p.id === "both_zero_check");
    expect(bz).toBeDefined();
    expect(bz!.outputIsBoolean).toBe(true);
    expect(bz!.slots.filter((s) => !s.isOutput)).toHaveLength(2);
  });

  it("includes two_part_average (correct average-speed formula)", () => {
    const avg = FORMULA_PATTERNS.find((p) => p.id === "two_part_average");
    expect(avg).toBeDefined();
    expect(avg!.slots.filter((s) => !s.isOutput)).toHaveLength(4);
  });

  it("includes equality_within_tolerance", () => {
    const ewt = FORMULA_PATTERNS.find((p) => p.id === "equality_within_tolerance");
    expect(ewt).toBeDefined();
    expect(ewt!.outputIsBoolean).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  getPatternById                                                     */
/* ------------------------------------------------------------------ */

describe("getPatternById", () => {
  it("returns a known pattern", () => {
    const p = getPatternById("division");
    expect(p).toBeDefined();
    expect(p!.label).toContain("Division");
  });

  it("returns undefined for unknown id", () => {
    expect(getPatternById("nonexistent")).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  instantiatePattern                                                 */
/* ------------------------------------------------------------------ */

describe("instantiatePattern", () => {
  it("division: pressure = force / area", () => {
    const p = getPatternById("division")!;
    const expr = instantiatePattern(p, {
      OUT: "pressure",
      A: "force",
      B: "area",
    });
    expect(expr).toBe("pressure = force / area");
  });

  it("linear: distance = speed * time", () => {
    const p = getPatternById("linear")!;
    const expr = instantiatePattern(p, {
      OUT: "distance",
      A: "speed",
      B: "time",
    });
    expect(expr).toBe("distance = speed * time");
  });

  it("sum: total = a + b", () => {
    const p = getPatternById("sum")!;
    const expr = instantiatePattern(p, {
      OUT: "total",
      A: "a",
      B: "b",
    });
    expect(expr).toBe("total = a + b");
  });

  it("difference: delta = final_temp - initial_temp", () => {
    const p = getPatternById("difference")!;
    const expr = instantiatePattern(p, {
      OUT: "delta",
      A: "final_temp",
      B: "initial_temp",
    });
    expect(expr).toBe("delta = final_temp - initial_temp");
  });

  it("threshold: high_pressure = pressure > 50", () => {
    const p = getPatternById("threshold")!;
    const expr = instantiatePattern(p, {
      OUT: "high_pressure",
      A: "pressure",
    }, 50);
    expect(expr).toBe("high_pressure = pressure > 50");
  });

  it("threshold_lte: low_speed = speed <= 10", () => {
    const p = getPatternById("threshold_lte")!;
    const expr = instantiatePattern(p, {
      OUT: "low_speed",
      A: "speed",
    }, 10);
    expect(expr).toBe("low_speed = speed <= 10");
  });

  it("equality_within_tolerance: speeds_equal = abs(v1 - v2) < 0.001", () => {
    const p = getPatternById("equality_within_tolerance")!;
    const expr = instantiatePattern(p, {
      OUT: "speeds_equal",
      A: "v1",
      B: "v2",
    }, 0.001);
    expect(expr).toBe("speeds_equal = abs(v1 - v2) < 0.001");
  });

  it("two_part_average: average_speed = (d1 + d2) / (t1 + t2)", () => {
    const p = getPatternById("two_part_average")!;
    const expr = instantiatePattern(p, {
      OUT: "average_speed",
      A1: "leg1_distance",
      A2: "leg2_distance",
      B1: "leg1_time",
      B2: "leg2_time",
    });
    expect(expr).toBe(
      "average_speed = (leg1_distance + leg2_distance) / (leg1_time + leg2_time)",
    );
  });

  it("both_zero_check: both_zero = (speed_leg1 == 0) and (speed_leg2 == 0)", () => {
    const p = getPatternById("both_zero_check")!;
    const expr = instantiatePattern(p, {
      OUT: "both_zero",
      A: "speed_leg1",
      B: "speed_leg2",
    });
    expect(expr).toBe("both_zero = (speed_leg1 == 0) and (speed_leg2 == 0)");
  });

  it("throws when a slot is unmapped", () => {
    const p = getPatternById("division")!;
    expect(() =>
      instantiatePattern(p, { OUT: "pressure", A: "force" }),
    ).toThrow(/Slot 'B' not mapped/);
  });

  it("throws when threshold value is missing", () => {
    const p = getPatternById("threshold")!;
    expect(() =>
      instantiatePattern(p, { OUT: "high_pressure", A: "pressure" }),
    ).toThrow(/requires a threshold value/);
  });

  it("handles threshold value of 0", () => {
    const p = getPatternById("threshold")!;
    const expr = instantiatePattern(p, {
      OUT: "is_positive",
      A: "temperature",
    }, 0);
    expect(expr).toBe("is_positive = temperature > 0");
  });

  it("handles negative threshold value", () => {
    const p = getPatternById("threshold_lte")!;
    const expr = instantiatePattern(p, {
      OUT: "sub_zero",
      A: "temperature",
    }, -10);
    expect(expr).toBe("sub_zero = temperature <= -10");
  });
});

/* ------------------------------------------------------------------ */
/*  Bridge pattern scenario (Pressure lab)                             */
/* ------------------------------------------------------------------ */

describe("Pressure lab bridge pattern", () => {
  it("can build the two-rule bridge: division + threshold", () => {
    // Step 1: pressure = force / area
    const divP = getPatternById("division")!;
    const expr1 = instantiatePattern(divP, {
      OUT: "pressure",
      A: "force",
      B: "area",
    });
    expect(expr1).toBe("pressure = force / area");

    // Step 2: high_pressure = pressure > 50
    const thrP = getPatternById("threshold")!;
    const expr2 = instantiatePattern(thrP, {
      OUT: "high_pressure",
      A: "pressure",
    }, 50);
    expect(expr2).toBe("high_pressure = pressure > 50");

    // The derived boolean 'high_pressure' can now feed a decision table
    // mapping (high_pressure, surface_type) → effect
    // (Decision table builder handles that part)
  });
});

/* ------------------------------------------------------------------ */
/*  ENGINE-LEVEL tests: expressions through the real evaluator         */
/*  (not just string matching — proves expr-eval actually runs them)   */
/* ------------------------------------------------------------------ */

describe("Pattern expressions through the real expression evaluator", () => {
  it("threshold > pattern: pressure > 50 returns true when pressure is 80", () => {
    const pattern = getPatternById("threshold")!;
    const exprStr = instantiatePattern(
      pattern,
      { OUT: "high_pressure", A: "pressure" },
      50,
    );
    const parsed = parseRuleExpression(exprStr);
    expect(parsed.target).toBe("high_pressure");

    const result = evaluateExpression(parsed, { pressure: 80 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });

  it("threshold > pattern: pressure > 50 returns false when pressure is 30", () => {
    const pattern = getPatternById("threshold")!;
    const exprStr = instantiatePattern(
      pattern,
      { OUT: "high_pressure", A: "pressure" },
      50,
    );
    const parsed = parseRuleExpression(exprStr);
    const result = evaluateExpression(parsed, { pressure: 30 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(false);
  });

  it("threshold ≤ pattern: low_pressure <= 20 returns true when pressure is 15", () => {
    const pattern = getPatternById("threshold_lte")!;
    const exprStr = instantiatePattern(
      pattern,
      { OUT: "low_pressure", A: "pressure" },
      20,
    );
    const parsed = parseRuleExpression(exprStr);
    const result = evaluateExpression(parsed, { pressure: 15 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });

  it("division pattern: 200 / 4 = 50", () => {
    const pattern = getPatternById("division")!;
    const exprStr = instantiatePattern(pattern, {
      OUT: "pressure",
      A: "force",
      B: "area",
    });
    const parsed = parseRuleExpression(exprStr);
    const result = evaluateExpression(parsed, { force: 200, area: 4 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(50);
  });

  it("both_zero_check pattern: true when both inputs are 0", () => {
    const pattern = getPatternById("both_zero_check")!;
    const exprStr = instantiatePattern(pattern, {
      OUT: "both_zero",
      A: "speed_leg1",
      B: "speed_leg2",
    });
    const parsed = parseRuleExpression(exprStr);

    const resultTrue = evaluateExpression(parsed, { speed_leg1: 0, speed_leg2: 0 });
    expect(resultTrue.ok).toBe(true);
    if (resultTrue.ok) expect(resultTrue.value).toBe(true);

    const resultFalse = evaluateExpression(parsed, { speed_leg1: 5, speed_leg2: 0 });
    expect(resultFalse.ok).toBe(true);
    if (resultFalse.ok) expect(resultFalse.value).toBe(false);
  });

  it("equality_within_tolerance pattern: true when values are close", () => {
    const pattern = getPatternById("equality_within_tolerance")!;
    const exprStr = instantiatePattern(
      pattern,
      { OUT: "speeds_equal", A: "v1", B: "v2" },
      0.001,
    );
    const parsed = parseRuleExpression(exprStr);

    const resultClose = evaluateExpression(parsed, { v1: 10.0, v2: 10.0005 });
    expect(resultClose.ok).toBe(true);
    if (resultClose.ok) expect(resultClose.value).toBe(true);

    const resultFar = evaluateExpression(parsed, { v1: 10.0, v2: 10.5 });
    expect(resultFar.ok).toBe(true);
    if (resultFar.ok) expect(resultFar.value).toBe(false);
  });

  it("two_part_average pattern: (500+500)/(50+100) = 6.666...", () => {
    const pattern = getPatternById("two_part_average")!;
    const exprStr = instantiatePattern(pattern, {
      OUT: "avg_speed",
      A1: "d1",
      A2: "d2",
      B1: "t1",
      B2: "t2",
    });
    const parsed = parseRuleExpression(exprStr);
    const result = evaluateExpression(parsed, { d1: 500, d2: 500, t1: 50, t2: 100 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(1000 / 150, 6);
  });

  it("full Pressure bridge: division → threshold → boolean output", () => {
    // Step 1: compute pressure
    const divP = getPatternById("division")!;
    const divExpr = instantiatePattern(divP, {
      OUT: "pressure",
      A: "force",
      B: "area",
    });
    const parsedDiv = parseRuleExpression(divExpr);
    const divResult = evaluateExpression(parsedDiv, { force: 200, area: 4 });
    expect(divResult.ok).toBe(true);
    const pressureVal = divResult.ok ? divResult.value : 0;
    expect(pressureVal).toBe(50);

    // Step 2: threshold — is pressure > 30?
    const thrP = getPatternById("threshold")!;
    const thrExpr = instantiatePattern(thrP, {
      OUT: "high_pressure",
      A: "pressure",
    }, 30);
    const parsedThr = parseRuleExpression(thrExpr);
    const thrResult = evaluateExpression(parsedThr, { pressure: pressureVal as number });
    expect(thrResult.ok).toBe(true);
    if (thrResult.ok) expect(thrResult.value).toBe(true);

    // Step 3 (low pressure): force=10, area=10 → pressure=1, not > 30
    const divResult2 = evaluateExpression(parsedDiv, { force: 10, area: 10 });
    expect(divResult2.ok).toBe(true);
    const lowPressure = divResult2.ok ? divResult2.value : 0;
    expect(lowPressure).toBe(1);

    const thrResult2 = evaluateExpression(parsedThr, { pressure: lowPressure as number });
    expect(thrResult2.ok).toBe(true);
    if (thrResult2.ok) expect(thrResult2.value).toBe(false);
  });
});
