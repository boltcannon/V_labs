/**
 * Runtime validator for LabSpec.
 *
 * This file mirrors `lab-spec.ts` at runtime so that a YAML file authored by a
 * teacher can be checked before the engine ever runs. Cross-field constraints
 * that the TypeScript types cannot express (a `number` variable requires
 * `range`; a `categorical` variable requires `options`; rules must reference
 * an expression or a decision table but not both; every explorable_variable
 * must refer to a declared variable id) are enforced here via `superRefine`.
 *
 * Principle 1 (deterministic truth) is protected by this file: if a spec does
 * not validate, the loader refuses to hand it to the engine.
 */

import { z } from "zod";

// NOTE: we do not annotate the individual sub-schemas with their TypeScript
// twin types (e.g. `z.ZodType<Variable>`). Under `exactOptionalPropertyTypes:
// true`, Zod's inference of an optional field as `T | undefined` does not
// match a plain `T?`, so the annotation would falsely fail. We assert the
// top-level `LabSpec` shape at the `labSpecSchema` export instead.

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export const scaffoldingLevelSchema = z.enum(["high", "medium", "low", "none"]);

export const ncertClassSchema = z.union([
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10),
]);

export const subjectSchema = z.enum([
  "physics",
  "chemistry",
  "biology",
  "integrated-science",
]);

const idPattern = /^[a-z][a-z0-9_]*$/;
const idSchema = z
  .string()
  .min(1)
  .regex(
    idPattern,
    "IDs must be snake_case: lowercase letter, then letters/digits/underscores.",
  );

const scalarValueSchema = z.union([z.string(), z.number(), z.boolean()]);

/* ------------------------------------------------------------------ */
/* Science model                                                       */
/* ------------------------------------------------------------------ */

export const variableSchema = z
  .object({
    id: idSchema,
    label: z.string().min(1),
    type: z.enum(["number", "categorical", "boolean"]),
    unit: z.string().nullable(),
    range: z.tuple([z.number(), z.number()]).optional(),
    options: z.array(z.string().min(1)).min(2).optional(),
    role: z.enum(["input", "output", "derived"]),
    description: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "number") {
      if (!v.range) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Variable '${v.id}' is type=number and must have a range.`,
        });
      } else if (v.range[0] >= v.range[1]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Variable '${v.id}' has range [${v.range[0]}, ${v.range[1]}] — min must be < max.`,
        });
      }
      if (v.options) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Variable '${v.id}' is type=number and must not declare options.`,
        });
      }
    }
    if (v.type === "categorical") {
      if (!v.options) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Variable '${v.id}' is type=categorical and must declare options (>=2).`,
        });
      }
      if (v.range) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Variable '${v.id}' is type=categorical and must not declare range.`,
        });
      }
    }
    if (v.type === "boolean") {
      if (v.range || v.options) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Variable '${v.id}' is type=boolean and must not declare range or options.`,
        });
      }
    }
  });

export const ruleSchema = z
  .object({
    id: idSchema,
    description: z.string().min(1),
    expression: z.string().min(1).optional(),
    decision_table_ref: idSchema.optional(),
    validated_by: z.string().min(1),
  })
  .superRefine((r, ctx) => {
    const hasExpr = !!r.expression;
    const hasTable = !!r.decision_table_ref;
    if (hasExpr === hasTable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Rule '${r.id}' must declare exactly one of 'expression' or 'decision_table_ref'.`,
      });
    }
  });

export const decisionTableRowSchema = z.object({
  when: z.record(z.string(), scalarValueSchema),
  then: scalarValueSchema,
});

export const decisionTableSchema = z
  .object({
    id: idSchema,
    inputs: z.array(idSchema).min(1),
    output: idSchema,
    rows: z.array(decisionTableRowSchema).min(1),
    default: scalarValueSchema.optional(),
  })
  .superRefine((t, ctx) => {
    for (let i = 0; i < t.rows.length; i++) {
      const row = t.rows[i]!;
      const rowKeys = Object.keys(row.when);
      for (const k of rowKeys) {
        if (!t.inputs.includes(k)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["rows", i, "when", k],
            message: `Decision table '${t.id}' row ${i} references input '${k}' not in inputs list.`,
          });
        }
      }
    }
  });

/**
 * Extract the output variable id a rule produces. Used to enforce that no
 * two rules produce the same variable — a spec that violates this is
 * ambiguous and the engine's topological sort cannot resolve it.
 */
function ruleOutputVar(
  rule: { expression?: string | undefined; decision_table_ref?: string | undefined },
  tables: Map<string, { output: string }>,
): string | null {
  if (rule.expression) {
    const m = /^\s*([a-z][a-z0-9_]*)\s*=(?!=)/.exec(rule.expression);
    return m ? m[1]! : null;
  }
  if (rule.decision_table_ref) {
    const t = tables.get(rule.decision_table_ref);
    return t ? t.output : null;
  }
  return null;
}

export const scienceModelSchema = z
  .object({
    variables: z.array(variableSchema).min(1),
    rules: z.array(ruleSchema).min(1),
    decision_tables: z.array(decisionTableSchema).optional(),
    validity_bounds: z.array(z.string().min(1)).optional(),
  })
  .superRefine((sm, ctx) => {
    const varIds = new Set(sm.variables.map((v) => v.id));

    // unique variable ids
    if (varIds.size !== sm.variables.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "science_model.variables ids must be unique.",
      });
    }

    // unique rule ids
    const ruleIds = new Set(sm.rules.map((r) => r.id));
    if (ruleIds.size !== sm.rules.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "science_model.rules ids must be unique.",
      });
    }

    // decision table references resolve
    const tableIds = new Set((sm.decision_tables ?? []).map((t) => t.id));
    for (const r of sm.rules) {
      if (r.decision_table_ref && !tableIds.has(r.decision_table_ref)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Rule '${r.id}' references unknown decision_table '${r.decision_table_ref}'.`,
        });
      }
    }

    // decision table inputs & outputs are declared variables
    const tablesById = new Map(
      (sm.decision_tables ?? []).map((t) => [t.id, t]),
    );
    for (const t of sm.decision_tables ?? []) {
      for (const inp of t.inputs) {
        if (!varIds.has(inp)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Decision table '${t.id}' input '${inp}' is not a declared variable.`,
          });
        }
      }
      if (!varIds.has(t.output)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Decision table '${t.id}' output '${t.output}' is not a declared variable.`,
        });
      }
    }

    // At most one rule per output variable. Two rules producing the same
    // variable is ambiguous — the topological sort cannot decide which
    // wins. Fail early so the teacher fixes the spec, not the engine.
    const outputsSeen = new Map<string, string>(); // var_id -> first_rule_id
    for (const r of sm.rules) {
      const outVar = ruleOutputVar(r, tablesById);
      if (outVar === null) continue; // shape errors already reported above
      if (!varIds.has(outVar)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Rule '${r.id}' produces variable '${outVar}' which is not declared in science_model.variables.`,
        });
        continue;
      }
      const prior = outputsSeen.get(outVar);
      if (prior !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Rules '${prior}' and '${r.id}' both produce variable '${outVar}'. Each variable may be produced by at most one rule.`,
        });
      } else {
        outputsSeen.set(outVar, r.id);
      }

      // A rule must produce a variable whose role is 'output' or 'derived',
      // never 'input'. Inputs are supplied by the student.
      const v = sm.variables.find((vv) => vv.id === outVar)!;
      if (v.role === "input") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Rule '${r.id}' writes to variable '${outVar}' which has role='input'. Only 'output' or 'derived' variables may be produced by rules.`,
        });
      }
    }
  });

/* ------------------------------------------------------------------ */
/* Pedagogical stages                                                  */
/* ------------------------------------------------------------------ */

export const metaSchema = z.object({
  topic: z.string().min(1),
  ncert_class: ncertClassSchema,
  subject: subjectSchema,
  chapter_reference: z.string().min(1),
  estimated_duration_minutes: z.number().int().positive(),
  authors: z.array(z.string().min(1)).min(1),
  spec_version: z.string().min(1),
});

export const curriculumAlignmentSchema = z.object({
  learning_outcomes: z.array(z.string().min(1)).min(1),
  prior_knowledge_assumed: z.array(z.string().min(1)),
});

export const provocationSchema = z.object({
  real_life_scenario: z.string().min(1),
  curiosity_hook: z.string().min(1),
  motivating_question: z.string().min(1),
  scaffolding_level: scaffoldingLevelSchema,
});

export const keyTermSchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});

export const nclSchema = z.object({
  concepts_required: z.array(z.string().min(1)).min(1),
  key_terms: z.array(keyTermSchema).min(1),
  scaffolding_level: scaffoldingLevelSchema,
});

export const experimentSchema = z.object({
  id: idSchema,
  goal: z.string().min(1),
  controlled_vars: z.array(idSchema),
  manipulated_vars: z.array(idSchema).min(1),
  measured_vars: z.array(idSchema).min(1),
  exercises_rules: z.array(idSchema).optional(),
  preset: z.record(idSchema, scalarValueSchema).optional(),
});

export const investigationSchema = z.object({
  orientation_prompt: z.string().min(1),
  questioning_prompts: z.array(z.string().min(1)).min(1),
  hypothesis_scaffolds: z.array(z.string().min(1)).min(1),
  explorable_variables: z.array(idSchema).min(1),
  experiments: z.array(experimentSchema).min(1),
  data_interpretation_prompts: z.array(z.string().min(1)).min(1),
  scaffolding_level: scaffoldingLevelSchema,
});

export const analysisSchema = z.object({
  guiding_questions: z.array(z.string().min(1)).min(1),
  expected_patterns: z.array(z.string().min(1)).min(1),
  scaffolding_level: scaffoldingLevelSchema,
});

export const discussionSchema = z.object({
  discussion_prompts: z.array(z.string().min(1)).min(1),
  peer_interaction_type: z.string().min(1),
  scaffolding_level: scaffoldingLevelSchema,
});

export const reflectionSchema = z.object({
  reflection_prompts: z.array(z.string().min(1)).min(1),
  metacognitive_prompts: z.array(z.string().min(1)).min(1),
  scaffolding_level: scaffoldingLevelSchema,
});

export const rubricCriterionSchema = z.object({
  criterion: z.string().min(1),
  levels: z.array(z.string().min(1)).min(2),
});

export const assessmentSchema = z.object({
  rubric: z.array(rubricCriterionSchema).min(1),
  formative_checks: z.array(z.string().min(1)).min(1),
});

export const aiTutorConfigSchema = z.object({
  allowed_actions: z
    .array(
      z.enum([
        "hint",
        "rephrase_question",
        "encourage",
        "socratic_prompt",
        "summarize_student_reasoning",
      ]),
    )
    .min(1),
  forbidden_actions: z
    .array(
      z.enum([
        "compute_science",
        "state_scientific_fact",
        "give_final_answer",
      ]),
    )
    .min(1),
  fallback_when_asked_science: z.string().min(1),
});

/* ------------------------------------------------------------------ */
/* Schema v2 — prediction, misconceptions, choice points (all optional) */
/* Shapes only. Cross-references and engine-evaluated checks (V1–V8)   */
/* live in the spec validator, not here.                               */
/* ------------------------------------------------------------------ */

export const predictionOptionSchema = z.object({
  id: idSchema,
  label: z.string().min(1),
  correct_when: z.string().min(1),
  maps_to_misconception: idSchema.nullable().optional(),
});

export const predictionItemSchema = z.object({
  id: idSchema,
  experiment_ref: idSchema,
  question: z.string().min(1),
  options: z.array(predictionOptionSchema).min(2),
});

export const predictionSchema = z.object({
  gate: z.boolean(),
  input_mode: z.enum(["choice", "sort", "numeric"]),
  items: z.array(predictionItemSchema).min(1),
});

export const misconceptionSchema = z.object({
  id: idSchema,
  statement: z.string().min(1),
  source: z.string().min(1),
  detected_when: z.object({ prediction_option: idSchema }),
  discrepant_event: z.object({ experiment_ref: idSchema }),
  revision: z.object({
    explain_prompt: z.string().min(1),
    compare_prompt: z.string().min(1),
    revise_prompt: z.string().min(1),
    alternative_model: z.string().min(1),
  }),
});

export const choicePointSchema = z.object({
  id: idSchema,
  prompt: z.string().min(1),
  options: z
    .array(
      z.object({
        id: idSchema,
        label: z.string().min(1),
        routes_to_misconception: idSchema,
      }),
    )
    .min(1),
});

/**
 * Check one preset value against its variable's declaration. Returns an
 * error message, or null if the value is acceptable. Mirrors the engine's
 * input type-check so a preset can always be fed straight to `runLab()`.
 */
function presetValueError(
  v: { type: string; range?: [number, number] | undefined; options?: string[] | undefined },
  val: string | number | boolean,
): string | null {
  if (v.type === "number") {
    if (typeof val !== "number") return `expected number, got ${typeof val}`;
    if (v.range && (val < v.range[0] || val > v.range[1])) {
      return `value ${val} out of range [${v.range[0]}, ${v.range[1]}]`;
    }
    return null;
  }
  if (v.type === "categorical") {
    if (typeof val !== "string") return `expected string, got ${typeof val}`;
    if (v.options && !v.options.includes(val)) {
      return `value '${val}' not in options ${JSON.stringify(v.options)}`;
    }
    return null;
  }
  if (typeof val !== "boolean") return `expected boolean, got ${typeof val}`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Top-level                                                           */
/* ------------------------------------------------------------------ */

export const labSpecSchema = z
  .object({
    meta: metaSchema,
    curriculum_alignment: curriculumAlignmentSchema,
    science_model: scienceModelSchema,
    provocation: provocationSchema,
    ncl: nclSchema,
    investigation: investigationSchema,
    analysis: analysisSchema,
    discussion: discussionSchema,
    reflection: reflectionSchema,
    assessment: assessmentSchema,
    ai_tutor_config: aiTutorConfigSchema,
    prediction: predictionSchema.optional(),
    misconceptions: z.array(misconceptionSchema).min(1).optional(),
    choice_points: z.array(choicePointSchema).min(1).optional(),
  })
  .superRefine((spec, ctx) => {
    const varIds = new Set(spec.science_model.variables.map((v) => v.id));
    const varsById = new Map(spec.science_model.variables.map((v) => [v.id, v]));

    // every explorable_variable exists
    for (const id of spec.investigation.explorable_variables) {
      if (!varIds.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["investigation", "explorable_variables"],
          message: `explorable_variables references unknown variable '${id}'.`,
        });
      }
    }

    // every experiment variable id exists
    for (let i = 0; i < spec.investigation.experiments.length; i++) {
      const exp = spec.investigation.experiments[i]!;
      const check = (list: string[], field: string) => {
        for (const id of list) {
          if (!varIds.has(id)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["investigation", "experiments", i, field],
              message: `experiment '${exp.id}'.${field} references unknown variable '${id}'.`,
            });
          }
        }
      };
      check(exp.controlled_vars, "controlled_vars");
      check(exp.manipulated_vars, "manipulated_vars");
      check(exp.measured_vars, "measured_vars");

      if (exp.exercises_rules) {
        const ruleIds = new Set(spec.science_model.rules.map((r) => r.id));
        for (const rid of exp.exercises_rules) {
          if (!ruleIds.has(rid)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["investigation", "experiments", i, "exercises_rules"],
              message: `experiment '${exp.id}' references unknown rule '${rid}'.`,
            });
          }
        }
      }

      // Schema v2: preset keys are declared input variables, values valid.
      for (const [id, val] of Object.entries(exp.preset ?? {})) {
        const path = ["investigation", "experiments", i, "preset", id];
        const v = varsById.get(id);
        if (!v) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path,
            message: `experiment '${exp.id}' preset references unknown variable '${id}'.`,
          });
          continue;
        }
        if (v.role !== "input") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path,
            message: `experiment '${exp.id}' presets '${id}' which has role='${v.role}'. Only input variables may be preset.`,
          });
          continue;
        }
        const err = presetValueError(v, val);
        if (err) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path,
            message: `experiment '${exp.id}' preset '${id}': ${err}.`,
          });
        }
      }
    }

    // AI tutor: allowed and forbidden actions must not overlap
    const allowed = new Set<string>(spec.ai_tutor_config.allowed_actions);
    for (const forbidden of spec.ai_tutor_config.forbidden_actions) {
      if (allowed.has(forbidden)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ai_tutor_config"],
          message: `Action '${forbidden}' appears in both allowed and forbidden lists.`,
        });
      }
    }
  });

export type LabSpecInput = z.input<typeof labSpecSchema>;
