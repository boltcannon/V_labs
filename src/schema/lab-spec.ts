/**
 * LabSpec — the canonical TypeScript shape of a teacher-authored virtual lab.
 *
 * This file is the single source of truth for what a lab IS. The Zod validator
 * in `lab-spec.zod.ts` mirrors these shapes at runtime; the YAML files in
 * `src/specs/` conform to it; the rule engine (next checkpoint) consumes it.
 *
 * Design intent (mapped to the 9 non-negotiable principles in schema-rationale.md):
 *   - Principle 1 (deterministic truth): `science_model` fully declares variables,
 *     rules, and decision tables so the engine can compute outcomes without an LLM.
 *   - Principle 2 (NCERT alignment): `curriculum_alignment` is mandatory and
 *     carries verbatim NCERT learning outcomes and chapter references.
 *   - Principle 3 (real-life framing): `provocation.real_life_scenario` is required.
 *   - Principle 4 (full inquiry cycle): the top-level sections `provocation`, `ncl`,
 *     `investigation`, `analysis`, `discussion`, `reflection`, `assessment` cover the
 *     unit shell; `investigation` internally carries Pedaste's inquiry sub-phases.
 *   - Principle 5 (fading scaffolding): every stage has a `scaffolding_level`.
 *   - Principle 6 (managed cognitive load): stages are separable objects, each
 *     carrying only the fields relevant at that stage.
 *   - Principle 7 (motivational hooks): `curiosity_hook`, `motivating_question`,
 *     and progress-friendly fields live at their natural stage.
 *   - Principle 8 (AI never invents science): `ai_tutor_config` carries an explicit
 *     allow/forbid list; the schema itself contains no field the AI could write into.
 *   - Principle 9 (teacher-authorable): all fields are plain YAML-authorable
 *     scalars and lists; no code, no embedded logic beyond declarative expressions.
 */

/* ------------------------------------------------------------------ */
/* Reusable primitive shapes                                           */
/* ------------------------------------------------------------------ */

export type ScaffoldingLevel = "high" | "medium" | "low" | "none";

export type NcertClass = 6 | 7 | 8 | 9 | 10;

export type Subject =
  | "physics"
  | "chemistry"
  | "biology"
  | "integrated-science";

export type VariableType = "number" | "categorical" | "boolean";

export type VariableRole = "input" | "output" | "derived";

/**
 * A single variable in the science model.
 *
 * Cross-field constraints (enforced by Zod, not the TS types alone):
 *   - type=number      → `range` required, `options` forbidden.
 *   - type=categorical → `options` required (>=2), `range` forbidden.
 *   - type=boolean     → both forbidden.
 */
export interface Variable {
  id: string;
  label: string;
  type: VariableType;
  unit: string | null;
  range?: [number, number];
  options?: string[];
  role: VariableRole;
  description?: string;
}

/**
 * A declarative rule. Either `expression` (math) or `decision_table_ref`
 * (points at science_model.decision_tables[].id) — exactly one.
 */
export interface Rule {
  id: string;
  description: string;
  /** Human-readable expression, e.g. "distance = speed * time". Parsed by expr-eval, never eval(). */
  expression?: string;
  /** ID of a decision table under science_model.decision_tables. */
  decision_table_ref?: string;
  /** Citation, textbook page, or SME note that validates this rule. */
  validated_by: string;
}

/** A row in a decision table: values-in → value-out. */
export interface DecisionTableRow {
  /** Map of input variable id → the value that matches this row. */
  when: Record<string, string | number | boolean>;
  /** The output variable's value when `when` matches. */
  then: string | number | boolean;
}

export interface DecisionTable {
  id: string;
  inputs: string[]; // variable ids
  output: string; // variable id
  rows: DecisionTableRow[];
  /** Optional default when no row matches. If omitted, engine returns null. */
  default?: string | number | boolean;
}

export interface ScienceModel {
  variables: Variable[];
  rules: Rule[];
  decision_tables?: DecisionTable[];
  /**
   * Schema v2. Plain-language statements of where the model stops being
   * scientifically honest (e.g. "Bulb resistance treated as constant").
   */
  validity_bounds?: string[];
}

/* ------------------------------------------------------------------ */
/* Pedagogical stages                                                  */
/* ------------------------------------------------------------------ */

export interface Meta {
  topic: string;
  ncert_class: NcertClass;
  subject: Subject;
  chapter_reference: string;
  estimated_duration_minutes: number;
  authors: string[];
  spec_version: string;
}

export interface CurriculumAlignment {
  learning_outcomes: string[];
  prior_knowledge_assumed: string[];
}

export interface Provocation {
  real_life_scenario: string;
  curiosity_hook: string;
  motivating_question: string;
  scaffolding_level: ScaffoldingLevel;
}

export interface KeyTerm {
  term: string;
  definition: string;
}

/** New Content Learning stage. */
export interface Ncl {
  concepts_required: string[];
  key_terms: KeyTerm[];
  scaffolding_level: ScaffoldingLevel;
}

export interface Experiment {
  id: string;
  goal: string;
  controlled_vars: string[];
  manipulated_vars: string[];
  measured_vars: string[];
  /** Rule ids this experiment expects to exercise. Used by tests to check coverage. */
  exercises_rules?: string[];
  /**
   * Schema v2. Input variable id → starting value for this experiment.
   * Each key must be a declared `input`-role variable and each value must
   * pass that variable's type and range/options. Prediction checks (T2)
   * evaluate `correct_when` at this point.
   */
  preset?: Record<string, string | number | boolean>;
}

export interface Investigation {
  orientation_prompt: string;
  questioning_prompts: string[];
  hypothesis_scaffolds: string[];
  explorable_variables: string[]; // references science_model.variables[].id
  experiments: Experiment[];
  data_interpretation_prompts: string[];
  scaffolding_level: ScaffoldingLevel;
}

export interface Analysis {
  guiding_questions: string[];
  /** Patterns the AI tutor is ALLOWED to check the student's answer against. Never generated. */
  expected_patterns: string[];
  scaffolding_level: ScaffoldingLevel;
}

export interface Discussion {
  discussion_prompts: string[];
  peer_interaction_type: string;
  scaffolding_level: ScaffoldingLevel;
}

export interface Reflection {
  reflection_prompts: string[];
  metacognitive_prompts: string[];
  scaffolding_level: ScaffoldingLevel;
}

export interface RubricCriterion {
  criterion: string;
  /** Ordered from lowest to highest, each a short descriptor. */
  levels: string[];
}

export interface Assessment {
  rubric: RubricCriterion[];
  formative_checks: string[];
}

export type AllowedAction =
  | "hint"
  | "rephrase_question"
  | "encourage"
  | "socratic_prompt"
  | "summarize_student_reasoning";

export type ForbiddenAction =
  | "compute_science"
  | "state_scientific_fact"
  | "give_final_answer";

export interface AiTutorConfig {
  allowed_actions: AllowedAction[];
  forbidden_actions: ForbiddenAction[];
  /** Verbatim policy string the tutor uses when a student asks for a scientific answer. */
  fallback_when_asked_science: string;
}

/* ------------------------------------------------------------------ */
/* Schema v2 — prediction gate, misconceptions, choice points          */
/* All optional; a v1 spec omits them entirely.                        */
/* ------------------------------------------------------------------ */

/** How the student commits a prediction. No free text in v2. */
export type PredictionInputMode = "choice" | "sort" | "numeric";

export interface PredictionOption {
  id: string;
  label: string;
  /**
   * Condition over variable ids, evaluated by the engine against the
   * experiment's outputs (e.g. "i_after_bulb1 < i_before_bulb1"). This is
   * the answer key: it must never reach the client or the tutor.
   */
  correct_when: string;
  /** Misconception id this option reveals, or null/omitted for none. */
  maps_to_misconception?: string | null;
}

export interface PredictionItem {
  id: string;
  /** Experiment whose run resolves this prediction. */
  experiment_ref: string;
  question: string;
  options: PredictionOption[];
}

export interface Prediction {
  /** When true, the student must commit a prediction before running. */
  gate: boolean;
  input_mode: PredictionInputMode;
  items: PredictionItem[];
}

/**
 * The post-discrepancy sequence. A failed prediction is an opportunity
 * for conceptual revision, not proof of it, so all four are required.
 */
export interface MisconceptionRevision {
  explain_prompt: string;
  compare_prompt: string;
  revise_prompt: string;
  /**
   * Teacher-authored model, shown only after a revision attempt. The
   * tutor may not state it.
   */
  alternative_model: string;
}

export interface Misconception {
  id: string;
  statement: string;
  /** Research citation for the misconception. */
  source: string;
  /** Deterministic trigger — no LLM in detection. */
  detected_when: { prediction_option: string };
  discrepant_event: { experiment_ref: string };
  revision: MisconceptionRevision;
}

export interface ChoicePointOption {
  id: string;
  label: string;
  routes_to_misconception: string;
}

/** Bounded learner agency: a choice of what to test next. */
export interface ChoicePoint {
  id: string;
  prompt: string;
  options: ChoicePointOption[];
}

/* ------------------------------------------------------------------ */
/* The top-level LabSpec                                               */
/* ------------------------------------------------------------------ */

export interface LabSpec {
  meta: Meta;
  curriculum_alignment: CurriculumAlignment;
  science_model: ScienceModel;
  provocation: Provocation;
  ncl: Ncl;
  investigation: Investigation;
  analysis: Analysis;
  discussion: Discussion;
  reflection: Reflection;
  assessment: Assessment;
  ai_tutor_config: AiTutorConfig;
  /** Schema v2. */
  prediction?: Prediction;
  /** Schema v2. */
  misconceptions?: Misconception[];
  /** Schema v2. */
  choice_points?: ChoicePoint[];
}

/* ------------------------------------------------------------------ */
/* Branded ValidatedLabSpec — enforcement of Principle 8 by the type   */
/* system, not by convention.                                          */
/* ------------------------------------------------------------------ */

/**
 * Phantom brand symbol. `declare const` means this symbol has no runtime
 * existence; a caller cannot construct a value with this property key at
 * runtime, and cannot reference the symbol from outside this module to add
 * it to a cast. Only the spec loader — which imports the internal brand
 * indirectly through `asValidatedLabSpec()` — can produce a value that
 * TypeScript accepts as `ValidatedLabSpec`.
 *
 * This is the mechanism that upgrades Principle 8 from a coding convention
 * ("please always call the loader") to a type-system guarantee ("the
 * engine's public API refuses a hand-built spec").
 */
declare const validatedLabSpecBrand: unique symbol;

export type ValidatedLabSpec = LabSpec & {
  readonly [validatedLabSpecBrand]: true;
};

/**
 * Sole producer of `ValidatedLabSpec`. Called only from the loader, after
 * Zod validation has succeeded. NOT exported from the package's public
 * surface (see `src/index.ts` in a future prompt): the engine imports it
 * from here, the loader imports it from here, and nothing else does.
 *
 * The cast is deliberate. Do NOT replace it with a plain `LabSpec` return
 * type — that would defeat the brand.
 */
export function asValidatedLabSpec(spec: LabSpec): ValidatedLabSpec {
  return spec as ValidatedLabSpec;
}

/* ------------------------------------------------------------------ */
/* PublicLabSpec — serialisable, unbranded, safe to send to the client */
/* ------------------------------------------------------------------ */

/**
 * A structural copy of LabSpec that may cross the Next.js server→client
 * boundary. Notes on what's kept and what's redacted:
 *
 *   - `science_model.rules` and `science_model.decision_tables` are
 *     REDACTED. They are the engine's business. The client has no
 *     legitimate use for them, and the AI tutor (Prompt 4) will get
 *     rule/decision-table facts server-side via `runLab()`, never by
 *     receiving the raw rule list on the client.
 *
 *   - `science_model.variables` is KEPT. Prompt 3's simulation UI needs
 *     variable metadata (label, type, unit, range, options) to draw
 *     sliders, dropdowns, and axis labels. This is the only legitimate
 *     client use of anything under `science_model`.
 *
 *   - Schema v2 `prediction` is included only as `PublicPrediction`:
 *     questions and option labels, with `correct_when` (the answer key)
 *     and `maps_to_misconception` removed. `misconceptions` and
 *     `choice_points` are NOT included: `alternative_model` must stay
 *     hidden until a revision attempt, and the server hands out the
 *     revision prompts only after a prediction is resolved.
 *
 *   - The brand is dropped by construction — `PublicLabSpec` is a plain
 *     interface with no `unique symbol` phantom field, so it is fully
 *     serialisable in the RSC payload.
 */
export interface PublicLabSpec {
  meta: Meta;
  curriculum_alignment: CurriculumAlignment;
  /** rules & decision_tables intentionally omitted — see interface comment. */
  science_model: { variables: Variable[] };
  provocation: Provocation;
  ncl: Ncl;
  investigation: Investigation;
  analysis: Analysis;
  discussion: Discussion;
  reflection: Reflection;
  assessment: Assessment;
  ai_tutor_config: AiTutorConfig;
  /** Schema v2, redacted. */
  prediction?: PublicPrediction;
}

/** Client-safe prediction: no answer key, no misconception mapping. */
export interface PublicPrediction {
  gate: boolean;
  input_mode: PredictionInputMode;
  items: Array<{
    id: string;
    experiment_ref: string;
    question: string;
    options: Array<{ id: string; label: string }>;
  }>;
}
