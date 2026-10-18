/**
 * Minimal schema-v2 spec builder, shared by the v2 schema tests (T1) and
 * the V1–V8 validator tests (T2).
 *
 * The science is a two-bulb series circuit cut down to the variables the
 * prediction/misconception fields need. Ids are lowercase snake_case, as
 * required by the schema id pattern (see CLAUDE.md §9).
 *
 * Returns a fresh plain object each call so tests can mutate it freely.
 */
export function v2Spec() {
  return {
    meta: {
      topic: "Series circuits",
      ncert_class: 10,
      subject: "physics",
      chapter_reference: "Fixture — not a real chapter reference",
      estimated_duration_minutes: 35,
      authors: ["Fixture"],
      spec_version: "0.2.0",
    },
    curriculum_alignment: {
      learning_outcomes: ["LO"],
      prior_knowledge_assumed: [],
    },
    science_model: {
      variables: [
        { id: "v", label: "Battery voltage", type: "number", unit: "V", range: [1.5, 12], role: "input" },
        { id: "r1", label: "Bulb 1 resistance", type: "number", unit: "Ω", range: [5, 50], role: "input" },
        { id: "r2", label: "Bulb 2 resistance", type: "number", unit: "Ω", range: [5, 50], role: "input" },
        { id: "i_series", label: "Series current", type: "number", unit: "A", range: [0, 10], role: "derived" },
        { id: "i_before_bulb1", label: "Current before bulb 1", type: "number", unit: "A", range: [0, 10], role: "output" },
        { id: "i_after_bulb1", label: "Current after bulb 1", type: "number", unit: "A", range: [0, 10], role: "output" },
      ],
      rules: [
        { id: "series_current", description: "d", expression: "i_series = v / (r1 + r2)", validated_by: "fixture" },
        { id: "before_bulb1", description: "d", expression: "i_before_bulb1 = i_series", validated_by: "fixture" },
        { id: "after_bulb1", description: "d", expression: "i_after_bulb1 = i_series", validated_by: "fixture" },
      ],
      validity_bounds: [
        "Ideal wires and battery (no internal resistance)",
        "Bulb resistance treated as constant",
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
      explorable_variables: ["v", "r1", "r2"],
      experiments: [
        {
          id: "exp_series_current",
          goal: "g",
          controlled_vars: ["v"],
          manipulated_vars: ["r1", "r2"],
          measured_vars: ["i_before_bulb1", "i_after_bulb1"],
          preset: { v: 6, r1: 10, r2: 10 } as Record<string, string | number | boolean>,
        },
      ],
      data_interpretation_prompts: ["p"],
      scaffolding_level: "medium",
    },
    analysis: { guiding_questions: ["g"], expected_patterns: ["p"], scaffolding_level: "medium" },
    discussion: { discussion_prompts: ["d"], peer_interaction_type: "pair", scaffolding_level: "medium" },
    reflection: { reflection_prompts: ["r"], metacognitive_prompts: ["m"], scaffolding_level: "low" },
    assessment: { rubric: [{ criterion: "c", levels: ["l1", "l2"] }], formative_checks: ["f"] },
    ai_tutor_config: {
      allowed_actions: ["hint"],
      forbidden_actions: ["compute_science", "state_scientific_fact", "give_final_answer"],
      fallback_when_asked_science: "route",
    },
    prediction: {
      gate: true,
      input_mode: "choice",
      items: [
        {
          id: "pred_current_after_bulb1",
          experiment_ref: "exp_series_current",
          question: "What will the ammeter after bulb 1 read?",
          options: [
            {
              id: "opt_less",
              label: "Less than before the bulb",
              correct_when: "i_after_bulb1 < i_before_bulb1",
              maps_to_misconception: "m_current_used_up" as string | null,
            },
            {
              id: "opt_same",
              label: "The same as before the bulb",
              correct_when: "i_after_bulb1 == i_before_bulb1",
              maps_to_misconception: null as string | null,
            },
            {
              id: "opt_more",
              label: "More than before the bulb",
              correct_when: "i_after_bulb1 > i_before_bulb1",
            },
          ],
        },
      ],
    },
    misconceptions: [
      {
        id: "m_current_used_up",
        statement: "Current is used up as it passes through a bulb.",
        source: "Verify: McDermott & Shaffer (1992); Shipstone (1984)",
        detected_when: { prediction_option: "opt_less" },
        discrepant_event: { experiment_ref: "exp_series_current" },
        revision: {
          explain_prompt: "FIXTURE_EXPLAIN_PROMPT",
          compare_prompt: "FIXTURE_COMPARE_PROMPT",
          revise_prompt: "FIXTURE_REVISE_PROMPT",
          alternative_model: "FIXTURE_ALTERNATIVE_MODEL_TEXT",
        },
      },
    ],
    choice_points: [
      {
        id: "cp_which_to_test",
        prompt: "What do you want to test first?",
        options: [
          { id: "cp_current", label: "Current before/after a bulb", routes_to_misconception: "m_current_used_up" },
        ],
      },
    ],
  };
}

export type V2SpecFixture = ReturnType<typeof v2Spec>;

/**
 * THESIS EVIDENCE FIXTURE — a discrepant event that configuration breaks.
 *
 * Same circuit, but the M1 prediction is asked about BRIGHTNESS instead
 * of current: "bulb 2 will be dimmer than bulb 1" (current used up). At
 * the preset r1 = r2 = 10 the bulbs are equally bright, so the mapped
 * option is false and the event looks discrepant (passes V2 and V3).
 * But r1 and r2 are unlocked, and wherever r2 < r1 bulb 2 really IS
 * dimmer — the misconception's prediction comes true. V4 must catch this
 * and name such a point. (CLAUDE.md §9: use current, not brightness.)
 */
export function brightnessSpec() {
  const spec = v2Spec();
  spec.science_model.variables.push(
    { id: "p1", label: "Bulb 1 power", type: "number", unit: "W", range: [0, 100], role: "output" },
    { id: "p2", label: "Bulb 2 power", type: "number", unit: "W", range: [0, 100], role: "output" },
  );
  spec.science_model.rules.push(
    { id: "power_bulb1", description: "d", expression: "p1 = i_series^2 * r1", validated_by: "fixture" },
    { id: "power_bulb2", description: "d", expression: "p2 = i_series^2 * r2", validated_by: "fixture" },
  );
  spec.investigation.experiments[0]!.measured_vars.push("p1", "p2");
  spec.prediction.items = [
    {
      id: "pred_bulb2_brightness",
      experiment_ref: "exp_series_current",
      question: "Compared with bulb 1, how bright will bulb 2 be?",
      options: [
        {
          id: "opt_b2_dimmer",
          label: "Dimmer — some current was used up by bulb 1",
          correct_when: "p2 < p1",
          maps_to_misconception: "m_current_used_up",
        },
        {
          id: "opt_b2_same",
          label: "Equally bright",
          correct_when: "p2 == p1",
          maps_to_misconception: null,
        },
        {
          id: "opt_b2_brighter",
          label: "Brighter",
          correct_when: "p2 > p1",
        },
      ],
    },
  ];
  spec.misconceptions[0]!.detected_when = { prediction_option: "opt_b2_dimmer" };
  return spec;
}
