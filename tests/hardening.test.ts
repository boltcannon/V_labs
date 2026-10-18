/**
 * Hardening after T1–T6:
 *   1. The expression parser has no `random()`: no rule or prediction
 *      condition can produce a non-deterministic value (Principle 1).
 *   2. The loader runs the spec validator (V1–V7), so an invalid v2 spec
 *      is refused at load — and therefore by the wizard's save action,
 *      which validates through the same `parseLabSpec`.
 */

import { describe, it, expect } from "vitest";
import yaml from "js-yaml";
import { parseLabSpec, SpecValidationError } from "../src/loader/spec-loader";
import { parseRuleExpression, parseCondition } from "../src/engine/expression-evaluator";
import { runLab } from "../src/engine/rule-engine";
import { validateSpec } from "../src/validator/spec-validator";
import { v2Spec, brightnessSpec } from "./fixtures/v2-spec";

/* ------------------------------------------------------------------ */
/* 1. No random()                                                       */
/* ------------------------------------------------------------------ */

describe("expression parser — random() is not available", () => {
  it("treats `random` as an unknown name, not a function", () => {
    expect(parseRuleExpression("y = x * random(1)").rhs_variables).toContain("random");
    expect(parseCondition("x > random(1)").variables).toContain("random");
  });

  it("a rule using random() never yields a number: the engine refuses to run it", () => {
    const spec = v2Spec();
    spec.science_model.rules[0]!.expression = "i_series = v / (r1 + r2) * random(1)";
    const loaded = parseLabSpec(yaml.dump(spec), "random-rule", { runSpecValidator: false });
    expect(() => runLab(loaded, { v: 6, r1: 10, r2: 10 })).toThrow(/random/);
  });

  it("…and a spec whose prediction depends on that rule is refused at load (V2: engine fails at the preset)", () => {
    const spec = v2Spec();
    spec.science_model.rules[0]!.expression = "i_series = v / (r1 + r2) * random(1)";
    expect(() => parseLabSpec(yaml.dump(spec), "random-rule")).toThrow(
      /V2: Prediction 'pred_current_after_bulb1': the engine failed at the preset/,
    );
  });

  it("a prediction condition using random() fails V2 as an unknown variable", () => {
    const spec = v2Spec();
    spec.prediction.items[0]!.options[2]!.correct_when = "i_after_bulb1 > random(1)";
    const issues = validateSpec(
      parseLabSpec(yaml.dump(spec), "random-condition", { runSpecValidator: false }),
    );
    expect(issues.map((i) => `${i.rule} ${i.message}`).join("\n")).toContain(
      "V2 Option 'opt_more' correct_when uses unknown variable 'random'",
    );
  });
});

/* ------------------------------------------------------------------ */
/* 2. The loader runs the validator                                     */
/* ------------------------------------------------------------------ */

describe("loader — runs the spec validator", () => {
  it("accepts a valid v2 spec", () => {
    expect(() => parseLabSpec(yaml.dump(v2Spec()), "valid")).not.toThrow();
  });

  it("refuses the brightness spec with a V4 issue naming the field", () => {
    let err: unknown;
    try {
      parseLabSpec(yaml.dump(brightnessSpec()), "brightness");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SpecValidationError);
    const issues = (err as SpecValidationError).issues;
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toBe("prediction.items[0].options[0].correct_when");
    expect(issues[0]!.message).toMatch(/^V4: Option 'opt_b2_dimmer'/);
    expect((err as Error).message).toContain("V4:");
  });

  it("refuses a V1/V7 violation with every issue reported", () => {
    const spec = v2Spec();
    spec.prediction.gate = false;
    spec.misconceptions[0]!.revision.alternative_model = "   ";
    let err: unknown;
    try {
      parseLabSpec(yaml.dump(spec), "two-issues");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SpecValidationError);
    const rules = (err as SpecValidationError).issues.map((i) => i.message.slice(0, 3)).sort();
    expect(rules).toEqual(["V1:", "V7:"]);
  });

  it("does not run the validator when the spec fails Zod first", () => {
    const spec = v2Spec();
    (spec.prediction as Record<string, unknown>).input_mode = "free_text";
    let err: unknown;
    try {
      parseLabSpec(yaml.dump(spec), "zod-fail");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(SpecValidationError);
    for (const i of (err as SpecValidationError).issues) {
      expect(i.message).not.toMatch(/^V\d:/);
    }
  });

  it("runSpecValidator: false skips it (for tests that inspect the issues directly)", () => {
    expect(() =>
      parseLabSpec(yaml.dump(brightnessSpec()), "brightness", { runSpecValidator: false }),
    ).not.toThrow();
  });
});
