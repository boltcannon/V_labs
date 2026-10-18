import { describe, it, expect } from "vitest";
import { planLab, runLab, CycleError } from "../src/engine/rule-engine";
import { parseLabSpec } from "../src/loader/spec-loader";
import { loadSpec, CLASS_9_PATH } from "./helpers";

/**
 * Topological ordering is what makes the derived-var bridge work: a rule
 * whose inputs are themselves computed by other rules must run AFTER those
 * rules, regardless of YAML author order. If a spec contains a cycle, the
 * engine must refuse to run and name the cycle for the author.
 */

describe("engine — topological order is by dependency, not YAML order", () => {
  it("YAML-reordered spec produces the same topological order", () => {
    const spec = loadSpec(CLASS_9_PATH);
    // Programmatically shuffle the rules and confirm the topo order is
    // still dependency-correct.
    const shuffled = structuredClone(spec);
    shuffled.science_model.rules = spec.science_model.rules.slice().reverse();

    const order = planLab(shuffled).topological_order;
    const idx = (id: string) => order.indexOf(id);
    expect(idx("speed_leg1_calc")).toBeLessThan(idx("speeds_equal_flag"));
    expect(idx("speeds_equal_flag")).toBeLessThan(idx("classify_motion"));

    // And the shuffled spec still runs to the same numeric answer.
    const r = runLab(shuffled, {
      leg1_distance: 500,
      leg1_time: 50,
      leg2_distance: 500,
      leg2_time: 100,
    });
    expect(r.values.average_speed).toBeCloseTo(1000 / 150, 6);
    expect(r.values.motion_class).toBe("non_uniform");
  });
});

describe("engine — cycle detection", () => {
  /** Handcrafted spec with a 2-rule cycle (a → b → a). */
  function cyclicSpec(): unknown {
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
        learning_outcomes: ["LO"],
        prior_knowledge_assumed: [],
      },
      science_model: {
        variables: [
          { id: "a", label: "A", type: "number", unit: "m", range: [0, 10], role: "derived" },
          { id: "b", label: "B", type: "number", unit: "m", range: [0, 10], role: "derived" },
        ],
        rules: [
          { id: "make_a", description: "a from b", expression: "a = b + 1", validated_by: "t" },
          { id: "make_b", description: "b from a", expression: "b = a + 1", validated_by: "t" },
        ],
      },
      provocation: {
        real_life_scenario: "s", curiosity_hook: "h", motivating_question: "q",
        scaffolding_level: "high",
      },
      ncl: {
        concepts_required: ["c"],
        key_terms: [{ term: "t", definition: "d" }],
        scaffolding_level: "high",
      },
      investigation: {
        orientation_prompt: "o", questioning_prompts: ["q"], hypothesis_scaffolds: ["h"],
        explorable_variables: ["a"],
        experiments: [
          { id: "e1", goal: "g", controlled_vars: [], manipulated_vars: ["a"], measured_vars: ["b"] },
        ],
        data_interpretation_prompts: ["p"], scaffolding_level: "medium",
      },
      analysis: { guiding_questions: ["g"], expected_patterns: ["p"], scaffolding_level: "medium" },
      discussion: { discussion_prompts: ["d"], peer_interaction_type: "pair", scaffolding_level: "medium" },
      reflection: { reflection_prompts: ["r"], metacognitive_prompts: ["m"], scaffolding_level: "low" },
      assessment: { rubric: [{ criterion: "c", levels: ["l1", "l2"] }], formative_checks: ["f"] },
      ai_tutor_config: {
        allowed_actions: ["hint"],
        forbidden_actions: ["compute_science"],
        fallback_when_asked_science: "route",
      },
    };
  }

  it("detects a 2-rule cycle and names both rules in the error", () => {
    const spec = parseLabSpec(JSON.stringify(cyclicSpec()));
    // ^ JSON is valid YAML for our loader.
    let err: unknown = null;
    try {
      planLab(spec);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(CycleError);
    const cycle = (err as CycleError).cycle_rule_ids;
    expect(cycle.slice().sort()).toEqual(["make_a", "make_b"]);
    expect((err as Error).message).toMatch(/make_a|make_b/);
  });
});
