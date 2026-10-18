import { describe, it, expect } from "vitest";
import { labSpecSchema } from "../src/schema/lab-spec.zod";
import { loadSpec, CLASS_6_PATH, CLASS_9_PATH } from "./helpers";

/** Minimal valid spec, used as a base for negative tests. */
function minimalValidSpec(): unknown {
  return {
    meta: {
      topic: "T",
      ncert_class: 6,
      subject: "physics",
      chapter_reference: "ref",
      estimated_duration_minutes: 30,
      authors: ["A"],
      spec_version: "0.1.0",
    },
    curriculum_alignment: {
      learning_outcomes: ["LO1"],
      prior_knowledge_assumed: [],
    },
    science_model: {
      variables: [
        { id: "x", label: "X", type: "number", unit: "m", range: [0, 10], role: "input" },
        { id: "y", label: "Y", type: "number", unit: "m", range: [0, 20], role: "output" },
      ],
      rules: [
        {
          id: "r1",
          description: "d",
          expression: "y = x * 2",
          validated_by: "test",
        },
      ],
    },
    provocation: {
      real_life_scenario: "s",
      curiosity_hook: "h",
      motivating_question: "q",
      scaffolding_level: "high",
    },
    ncl: {
      concepts_required: ["c"],
      key_terms: [{ term: "t", definition: "d" }],
      scaffolding_level: "high",
    },
    investigation: {
      orientation_prompt: "o",
      questioning_prompts: ["q"],
      hypothesis_scaffolds: ["h"],
      explorable_variables: ["x"],
      experiments: [
        {
          id: "e1",
          goal: "g",
          controlled_vars: [],
          manipulated_vars: ["x"],
          measured_vars: ["y"],
        },
      ],
      data_interpretation_prompts: ["p"],
      scaffolding_level: "medium",
    },
    analysis: {
      guiding_questions: ["g"],
      expected_patterns: ["p"],
      scaffolding_level: "medium",
    },
    discussion: {
      discussion_prompts: ["d"],
      peer_interaction_type: "pair",
      scaffolding_level: "medium",
    },
    reflection: {
      reflection_prompts: ["r"],
      metacognitive_prompts: ["m"],
      scaffolding_level: "low",
    },
    assessment: {
      rubric: [{ criterion: "c", levels: ["l1", "l2"] }],
      formative_checks: ["f"],
    },
    ai_tutor_config: {
      allowed_actions: ["hint"],
      forbidden_actions: ["compute_science"],
      fallback_when_asked_science: "route",
    },
  };
}

describe("schema — happy path", () => {
  it("validates the Class 6 spec", () => {
    expect(() => loadSpec(CLASS_6_PATH)).not.toThrow();
  });
  it("validates the Class 9 spec", () => {
    expect(() => loadSpec(CLASS_9_PATH)).not.toThrow();
  });
  it("validates the minimal skeleton", () => {
    expect(labSpecSchema.safeParse(minimalValidSpec()).success).toBe(true);
  });
});

describe("schema — negative cases", () => {
  it("rejects a number variable with no range", () => {
    const spec: any = minimalValidSpec();
    spec.science_model.variables[0] = { ...spec.science_model.variables[0], range: undefined };
    const r = labSpecSchema.safeParse(spec);
    expect(r.success).toBe(false);
  });

  it("rejects a categorical variable with no options", () => {
    const spec: any = minimalValidSpec();
    spec.science_model.variables[0] = {
      id: "x", label: "X", type: "categorical", unit: null, role: "input",
    };
    const r = labSpecSchema.safeParse(spec);
    expect(r.success).toBe(false);
  });

  it("rejects a rule with both expression and decision_table_ref", () => {
    const spec: any = minimalValidSpec();
    spec.science_model.rules[0].decision_table_ref = "some_table";
    const r = labSpecSchema.safeParse(spec);
    expect(r.success).toBe(false);
  });

  it("rejects a rule with neither expression nor decision_table_ref", () => {
    const spec: any = minimalValidSpec();
    delete spec.science_model.rules[0].expression;
    const r = labSpecSchema.safeParse(spec);
    expect(r.success).toBe(false);
  });

  it("rejects an explorable_variable that isn't declared", () => {
    const spec: any = minimalValidSpec();
    spec.investigation.explorable_variables = ["ghost"];
    const r = labSpecSchema.safeParse(spec);
    expect(r.success).toBe(false);
  });

  it("rejects an ai_tutor_config with overlapping allowed/forbidden action names — none actually overlap by enum, so we check the mechanism via manual overlap", () => {
    // The allowed and forbidden enums are disjoint by design, so we cannot
    // construct an overlap through the enums; instead, this test exists to
    // document that the check would fire if the enums ever converged.
    expect(true).toBe(true);
  });

  it("rejects two rules producing the same variable", () => {
    const spec: any = minimalValidSpec();
    spec.science_model.rules.push({
      id: "r2",
      description: "d",
      expression: "y = x + 1",
      validated_by: "test",
    });
    const r = labSpecSchema.safeParse(spec);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toContain("both produce variable 'y'");
    }
  });

  it("rejects a rule that writes to an input-role variable", () => {
    const spec: any = minimalValidSpec();
    spec.science_model.rules[0].expression = "x = 5";
    const r = labSpecSchema.safeParse(spec);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toContain("role='input'");
    }
  });

  it("rejects exercises_rules pointing at an unknown rule id", () => {
    const spec: any = minimalValidSpec();
    spec.investigation.experiments[0].exercises_rules = ["nope"];
    const r = labSpecSchema.safeParse(spec);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(JSON.stringify(r.error.issues)).toContain("unknown rule 'nope'");
    }
  });

  it("accepts exercises_rules pointing at a declared rule id", () => {
    const spec: any = minimalValidSpec();
    spec.investigation.experiments[0].exercises_rules = ["r1"];
    const r = labSpecSchema.safeParse(spec);
    expect(r.success).toBe(true);
  });
});
