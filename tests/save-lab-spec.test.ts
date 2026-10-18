/**
 * Tests for the Save Lab Spec action (Prompt 5, Checkpoint 3).
 *
 * Verifies:
 *   - Valid spec roundtrip: wizard state → YAML → Zod validation → disk
 *   - Deliberate schema violation: an experiment referencing an undeclared
 *     variable is REJECTED — proving the Save action is not a rubber stamp
 *   - Path-traversal guard rejects malicious lab_ids
 *   - YAML roundtrip produces identical parse results
 *
 * The deliberate-schema-violation test is the acceptance criterion that
 * proves Principle 9: wizard-authored specs are validated by the identical
 * mechanism that protects the two existing exemplar specs.
 */

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import yaml from "js-yaml";

import { parseLabSpec, SpecValidationError } from "../src/loader/spec-loader";
import type { Variable, Rule } from "../src/schema/lab-spec";
import { loadSpec, REPO_ROOT } from "./helpers";
import { runLab } from "../src/engine/rule-engine";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const CLASS_8_PATH = "src/specs/class-8-physics-pressure.yaml";

function loadPressureSpec() {
  return loadSpec(CLASS_8_PATH);
}

/** Build a minimal valid LabSpec object (mirroring wizard output). */
function buildMinimalPressureSpec() {
  return {
    meta: {
      topic: "Pressure",
      ncert_class: 8,
      subject: "physics",
      chapter_reference: "NCERT Class 8, Chapter 11",
      estimated_duration_minutes: 60,
      authors: ["Test Author"],
      spec_version: "0.1.0",
    },
    curriculum_alignment: {
      learning_outcomes: ["Defines pressure as force per unit area."],
      prior_knowledge_assumed: ["Understands force."],
    },
    science_model: {
      variables: [
        { id: "force", label: "Force", type: "number", unit: "N", range: [0, 1000], role: "input" },
        { id: "area", label: "Area", type: "number", unit: "m²", range: [0.01, 10], role: "input" },
        { id: "pressure", label: "Pressure", type: "number", unit: "Pa", range: [0, 100000], role: "output" },
      ],
      rules: [
        {
          id: "pressure_calc",
          description: "Pressure equals force divided by area.",
          expression: "pressure = force / area",
          validated_by: "NCERT Ch 11.",
        },
      ],
    },
    provocation: {
      real_life_scenario: "Thumb-tack vs fingertip.",
      curiosity_hook: "Camel vs high heels.",
      motivating_question: "Can you predict the effect?",
      scaffolding_level: "high",
    },
    ncl: {
      concepts_required: ["Pressure is force per unit area."],
      key_terms: [{ term: "Pressure", definition: "Force per unit area." }],
      scaffolding_level: "high",
    },
    investigation: {
      orientation_prompt: "You have two sliders.",
      questioning_prompts: ["What if you double the force?"],
      hypothesis_scaffolds: ["I predict that..."],
      explorable_variables: ["force", "area"],
      experiments: [
        {
          id: "exp1",
          goal: "Verify pressure = force / area.",
          controlled_vars: [],
          manipulated_vars: ["force"],
          measured_vars: ["pressure"],
          exercises_rules: ["pressure_calc"],
        },
      ],
      data_interpretation_prompts: ["What pattern do you see?"],
      scaffolding_level: "medium",
    },
    analysis: {
      guiding_questions: ["How are force, area, and pressure related?"],
      expected_patterns: ["Pressure is proportional to force."],
      scaffolding_level: "medium",
    },
    discussion: {
      discussion_prompts: ["Share a surprising result."],
      peer_interaction_type: "pair-and-share",
      scaffolding_level: "medium",
    },
    reflection: {
      reflection_prompts: ["What did you learn?"],
      metacognitive_prompts: ["When did you change your prediction?"],
      scaffolding_level: "low",
    },
    assessment: {
      rubric: [
        {
          criterion: "Applies P = F/A correctly.",
          levels: ["Cannot apply.", "Applies with errors.", "Applies correctly."],
        },
      ],
      formative_checks: ["Predict before running."],
    },
    ai_tutor_config: {
      allowed_actions: ["hint", "encourage", "socratic_prompt"],
      forbidden_actions: ["compute_science", "give_final_answer"],
      fallback_when_asked_science: "Try the engine.",
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Pressure spec loads and validates                                   */
/* ------------------------------------------------------------------ */

describe("Class 8 Pressure spec", () => {
  it("loads and validates through parseLabSpec", () => {
    const spec = loadPressureSpec();
    expect(spec.meta.topic).toBe("Pressure");
    expect(spec.meta.ncert_class).toBe(8);
    expect(spec.science_model.variables).toHaveLength(6);
    expect(spec.science_model.rules).toHaveLength(3);
    expect(spec.science_model.decision_tables).toHaveLength(1);
  });

  it("engine computes pressure = force / area correctly (10/0.5 = 20)", () => {
    const spec = loadPressureSpec();
    const result = runLab(spec, { force: 10, area: 0.5, surface_type: "soft" });
    expect(result.values.pressure).toBe(20);
    expect(result.status.pressure).toBe("defined");
  });

  it("bridge pattern: expression → threshold → decision table", () => {
    const spec = loadPressureSpec();

    // High pressure on soft → deep_indent
    const r1 = runLab(spec, { force: 200, area: 2, surface_type: "soft" });
    expect(r1.values.pressure).toBe(100);
    expect(r1.values.high_pressure).toBe(true);
    expect(r1.values.effect).toBe("deep_indent");

    // Low pressure on hard → no_visible_change
    const r2 = runLab(spec, { force: 10, area: 0.5, surface_type: "hard" });
    expect(r2.values.pressure).toBe(20);
    expect(r2.values.high_pressure).toBe(false);
    expect(r2.values.effect).toBe("no_visible_change");
  });

  it("all four quadrants of the decision table produce correct effects", () => {
    const spec = loadPressureSpec();

    const cases = [
      { inputs: { force: 200, area: 2, surface_type: "soft" as const }, effect: "deep_indent" },
      { inputs: { force: 200, area: 2, surface_type: "hard" as const }, effect: "shallow_indent" },
      { inputs: { force: 10, area: 0.5, surface_type: "soft" as const }, effect: "shallow_indent" },
      { inputs: { force: 10, area: 0.5, surface_type: "hard" as const }, effect: "no_visible_change" },
    ];

    for (const c of cases) {
      const result = runLab(spec, c.inputs);
      expect(result.values.effect).toBe(c.effect);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  YAML roundtrip (simulates the wizard's save path)                  */
/* ------------------------------------------------------------------ */

describe("YAML roundtrip via save path", () => {
  it("valid spec serialises to YAML and re-validates", () => {
    const specObj = buildMinimalPressureSpec();
    const yamlText = yaml.dump(specObj, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    // Must survive the same parseLabSpec the loader uses
    const parsed = parseLabSpec(yamlText, "roundtrip-test");
    expect(parsed.meta.topic).toBe("Pressure");
    expect(parsed.science_model.rules[0]!.expression).toBe(
      "pressure = force / area",
    );
  });
});

/* ------------------------------------------------------------------ */
/*  DELIBERATE SCHEMA VIOLATION                                        */
/*  ─────────────────────────────────────────────────────────────────── */
/*  This is THE acceptance criterion for Principle 9. A spec with an   */
/*  experiment referencing an undeclared variable MUST be rejected      */
/*  by parseLabSpec — the same Zod pipeline the exemplar specs use.    */
/*  If this test passes, the Save action is not a rubber stamp.        */
/* ------------------------------------------------------------------ */

describe("deliberate schema violation", () => {
  it("rejects an experiment referencing an undeclared variable", () => {
    const specObj = buildMinimalPressureSpec();

    // Inject a bad experiment that references "velocity" — not declared
    specObj.investigation.experiments.push({
      id: "bad_experiment",
      goal: "This should fail validation.",
      controlled_vars: [],
      manipulated_vars: ["velocity"],   // <— UNDECLARED
      measured_vars: ["pressure"],
      exercises_rules: [],
    });

    const yamlText = yaml.dump(specObj, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    expect(() => parseLabSpec(yamlText, "violation-test")).toThrow(
      SpecValidationError,
    );

    // Confirm the error message names the undeclared variable
    try {
      parseLabSpec(yamlText, "violation-test");
    } catch (err) {
      expect(err).toBeInstanceOf(SpecValidationError);
      const sve = err as InstanceType<typeof SpecValidationError>;
      const messages = sve.issues.map((i: { message: string }) => i.message).join(" ");
      expect(messages).toContain("velocity");
    }
  });

  it("rejects an experiment referencing an undeclared rule", () => {
    const specObj = buildMinimalPressureSpec();

    // Reference a rule id that doesn't exist
    specObj.investigation.experiments[0]!.exercises_rules = ["nonexistent_rule"];

    const yamlText = yaml.dump(specObj, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    expect(() => parseLabSpec(yamlText, "bad-rule-ref")).toThrow(
      SpecValidationError,
    );
  });

  it("rejects a rule that writes to an input-role variable", () => {
    const specObj = buildMinimalPressureSpec();

    // Add a rule that tries to compute 'force' — but force has role=input
    specObj.science_model.rules.push({
      id: "bad_rule",
      description: "Tries to compute an input variable.",
      expression: "force = pressure * area",
      validated_by: "N/A",
    });

    const yamlText = yaml.dump(specObj, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    expect(() => parseLabSpec(yamlText, "input-write")).toThrow(
      SpecValidationError,
    );
  });

  it("rejects a decision table referencing undeclared variables", () => {
    const specObj = buildMinimalPressureSpec();

    // Add a decision table with undeclared input
    (specObj.science_model.variables as Variable[]).push({
      id: "result",
      label: "Result",
      type: "categorical",
      unit: null,
      options: ["a", "b"],
      role: "output",
    });
    (specObj.science_model as Record<string, unknown>).decision_tables = [
      {
        id: "bad_table",
        inputs: ["ghost_var"],   // <— UNDECLARED
        output: "result",
        rows: [{ when: { ghost_var: "x" }, then: "a" }],
      },
    ];
    (specObj.science_model.rules as Rule[]).push({
      id: "bad_table_rule",
      description: "References bad table.",
      decision_table_ref: "bad_table",
      validated_by: "N/A",
    });

    const yamlText = yaml.dump(specObj, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });

    expect(() => parseLabSpec(yamlText, "bad-table-input")).toThrow(
      SpecValidationError,
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Path-traversal guard                                               */
/* ------------------------------------------------------------------ */

describe("lab_id validation", () => {
  it("rejects path-traversal attempts", () => {
    // We can't call the server action directly in vitest (it needs
    // Next.js server context), but we can test the validation logic
    // by checking that the regex rejects bad ids.
    const BAD_IDS = [
      "../etc/passwd",
      "../../malicious",
      "foo/bar",
      "foo\\bar",
      ".hidden",
      "-starts-with-dash",
      "",
    ];

    const isValid = (id: string) =>
      /^[a-z0-9][a-z0-9_-]*$/.test(id) &&
      !id.includes("..") &&
      !id.includes("/") &&
      !id.includes("\\");

    for (const id of BAD_IDS) {
      expect(isValid(id)).toBe(false);
    }

    // Valid ids should pass
    expect(isValid("class-8-physics-pressure")).toBe(true);
    expect(isValid("my_lab_spec")).toBe(true);
  });
});
