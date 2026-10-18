/**
 * End-to-end template authoring test.
 *
 * Proves the "teacher configurability" thesis metric: a teacher picks
 * an existing lab as a template, customises the non-science parts, and
 * the result passes the identical Zod + spec-validator pipeline that
 * hand-authored specs use.
 *
 * The test loads each of the 4 specs, converts to WizardState (the
 * same path the load-template server action uses), tweaks the topic
 * and authors, converts back to LabSpec via wizardStateToLabSpec, and
 * round-trips through YAML → parseLabSpec. If any step fails, the
 * template flow is broken.
 */

import { describe, it, expect } from "vitest";
import yaml from "js-yaml";

import { loadSpec, CLASS_6_PATH, CLASS_8_PATH, CLASS_9_PATH, CLASS_10_PATH } from "./helpers";
import { parseLabSpec } from "../src/loader/spec-loader";
import {
  type WizardState,
  wizardStateToLabSpec,
} from "../src/components/author/wizard-types";
import type { ValidatedLabSpec } from "../src/schema/lab-spec";

/* ------------------------------------------------------------------ */
/*  Helper: spec → WizardState (mirrors load-template.ts)              */
/* ------------------------------------------------------------------ */

function specToWizardState(spec: ValidatedLabSpec): WizardState {
  return {
    meta: { ...spec.meta, topic: "", authors: [""] },
    curriculum_alignment: spec.curriculum_alignment,
    variables: spec.science_model.variables,
    rules: spec.science_model.rules,
    decision_tables: spec.science_model.decision_tables ?? [],
    provocation: spec.provocation,
    ncl: spec.ncl,
    investigation: spec.investigation,
    analysis: spec.analysis,
    discussion: spec.discussion,
    reflection: spec.reflection,
    assessment: spec.assessment,
    ai_tutor_config: spec.ai_tutor_config,
  };
}

/* ------------------------------------------------------------------ */
/*  Template → customise → save roundtrip                              */
/* ------------------------------------------------------------------ */

describe("template-based authoring roundtrip", () => {
  const templates = [
    { name: "Class 6 Biology", path: CLASS_6_PATH },
    { name: "Class 8 Pressure", path: CLASS_8_PATH },
    { name: "Class 9 Motion", path: CLASS_9_PATH },
    { name: "Class 10 Electricity", path: CLASS_10_PATH },
  ];

  for (const t of templates) {
    it(`${t.name}: load → customise → YAML → parseLabSpec succeeds`, () => {
      const spec = loadSpec(t.path);

      // 1. Convert to WizardState (same as load-template server action)
      const ws = specToWizardState(spec);

      // 2. Teacher customises non-science fields
      ws.meta.topic = `My custom ${spec.meta.topic} lab`;
      ws.meta.authors = ["Teacher Singh (Delhi Public School)"];
      ws.provocation.curiosity_hook = "A new hook for my class.";
      ws.reflection.reflection_prompts = [
        "What surprised you the most?",
        "How would you explain this to a friend?",
      ];

      // 3. Convert back to LabSpec
      const labSpec = wizardStateToLabSpec(ws);

      // 4. Serialize to YAML
      const yamlText = yaml.dump(labSpec, {
        lineWidth: 120,
        noRefs: true,
        sortKeys: false,
      });

      // 5. Validate through parseLabSpec — the same pipeline as hand-authored specs
      const validated = parseLabSpec(yamlText, `template-test-${spec.meta.ncert_class}`);

      expect(validated.meta.topic).toBe(`My custom ${spec.meta.topic} lab`);
      expect(validated.meta.authors[0]).toBe("Teacher Singh (Delhi Public School)");
      expect(validated.provocation.curiosity_hook).toBe("A new hook for my class.");
      expect(validated.reflection.reflection_prompts).toHaveLength(2);

      // Science model is unchanged from the original
      expect(validated.science_model.variables).toHaveLength(
        spec.science_model.variables.length,
      );
      expect(validated.science_model.rules).toHaveLength(
        spec.science_model.rules.length,
      );
    });
  }

  it("customised template produces a different lab_id from the original", () => {
    const spec = loadSpec(CLASS_8_PATH);
    const ws = specToWizardState(spec);
    ws.meta.topic = "Forces in Daily Life";
    ws.meta.authors = ["Teacher Gupta"];

    const labSpec = wizardStateToLabSpec(ws);

    // Derive lab_id the same way the save action does
    const slug = labSpec.meta.topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const labId = `class-${labSpec.meta.ncert_class}-${labSpec.meta.subject}-${slug}`;

    expect(labId).toBe("class-8-physics-forces-in-daily-life");
    expect(labId).not.toBe("class-8-physics-pressure");
  });

  it("science model stays intact even when teacher changes all prompts", () => {
    const spec = loadSpec(CLASS_10_PATH);
    const ws = specToWizardState(spec);

    // Overwrite every prompt field
    ws.meta.topic = "Circuits for beginners";
    ws.meta.authors = ["Teacher Gupta"];
    ws.provocation.real_life_scenario = "New scenario";
    ws.provocation.curiosity_hook = "New hook";
    ws.provocation.motivating_question = "New question";
    ws.ncl.concepts_required = ["New concept"];
    ws.investigation.orientation_prompt = "New orientation";
    ws.investigation.questioning_prompts = ["New questioning"];
    ws.investigation.hypothesis_scaffolds = ["New scaffold"];
    ws.investigation.data_interpretation_prompts = ["New interpretation"];
    ws.analysis.guiding_questions = ["New analysis question"];
    ws.analysis.expected_patterns = ["New pattern"];
    ws.discussion.discussion_prompts = ["New discussion"];
    ws.reflection.reflection_prompts = ["New reflection"];
    ws.reflection.metacognitive_prompts = ["New metacognitive"];

    const labSpec = wizardStateToLabSpec(ws);
    const yamlText = yaml.dump(labSpec, { lineWidth: 120, noRefs: true, sortKeys: false });
    const validated = parseLabSpec(yamlText, "full-customise-test");

    // All science is preserved
    expect(validated.science_model.variables).toEqual(spec.science_model.variables);
    expect(validated.science_model.rules).toEqual(spec.science_model.rules);

    // Customised fields took effect
    expect(validated.meta.topic).toBe("Circuits for beginners");
    expect(validated.provocation.curiosity_hook).toBe("New hook");
  });
});
