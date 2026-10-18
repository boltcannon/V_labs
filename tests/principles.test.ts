import { describe, it, expect } from "vitest";
import { loadSpec, CLASS_6_PATH, CLASS_9_PATH } from "./helpers";

/**
 * Meta-tests: assert that every worked example carries the pedagogical
 * structure the framework requires. If a future spec is added and one of
 * these fails, the spec is incomplete — the test file names the missing
 * principle so the teacher knows what to add.
 */

const SPEC_PATHS = [CLASS_6_PATH, CLASS_9_PATH];

for (const rel of SPEC_PATHS) {
  const spec = loadSpec(rel);
  describe(`principles — ${rel}`, () => {
    it("principle 2: has curriculum_alignment with at least one NCERT learning outcome", () => {
      expect(spec.curriculum_alignment.learning_outcomes.length).toBeGreaterThan(0);
    });
    it("principle 3: has a real-life scenario in provocation", () => {
      expect(spec.provocation.real_life_scenario.length).toBeGreaterThan(0);
    });
    it("principle 4: investigation carries the inner inquiry sub-phases", () => {
      expect(spec.investigation.orientation_prompt.length).toBeGreaterThan(0);
      expect(spec.investigation.questioning_prompts.length).toBeGreaterThan(0);
      expect(spec.investigation.hypothesis_scaffolds.length).toBeGreaterThan(0);
      expect(spec.investigation.experiments.length).toBeGreaterThan(0);
      expect(spec.investigation.data_interpretation_prompts.length).toBeGreaterThan(0);
    });
    it("principle 5: scaffolding fades — provocation/ncl 'high', reflection 'low' or 'none'", () => {
      expect(["high", "medium"]).toContain(spec.provocation.scaffolding_level);
      expect(["high", "medium"]).toContain(spec.ncl.scaffolding_level);
      expect(["low", "none"]).toContain(spec.reflection.scaffolding_level);
    });
    it("principle 7: has a curiosity hook", () => {
      expect(spec.provocation.curiosity_hook.length).toBeGreaterThan(0);
    });
    it("principle 8: forbidden_actions includes compute_science, state_scientific_fact, give_final_answer", () => {
      expect(spec.ai_tutor_config.forbidden_actions).toContain("compute_science");
      expect(spec.ai_tutor_config.forbidden_actions).toContain("state_scientific_fact");
      expect(spec.ai_tutor_config.forbidden_actions).toContain("give_final_answer");
    });
    it("principle 9: every explorable_variable and experiment var resolves to a declared variable", () => {
      const declared = new Set(spec.science_model.variables.map((v) => v.id));
      for (const id of spec.investigation.explorable_variables) {
        expect(declared.has(id)).toBe(true);
      }
      for (const exp of spec.investigation.experiments) {
        for (const id of [
          ...exp.controlled_vars,
          ...exp.manipulated_vars,
          ...exp.measured_vars,
        ]) {
          expect(declared.has(id)).toBe(true);
        }
      }
    });
  });
}
