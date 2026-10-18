/**
 * Shared types for the authoring wizard's step components.
 *
 * Each step receives a slice of the wizard state and a callback to
 * update it. The wizard shell manages navigation between steps and
 * the final save.
 */

import type {
  Meta,
  CurriculumAlignment,
  Variable,
  Rule,
  DecisionTable,
  Provocation,
  Ncl,
  KeyTerm,
  Experiment,
  Investigation,
  Analysis,
  Discussion,
  Reflection,
  Assessment,
  RubricCriterion,
  AiTutorConfig,
  AllowedAction,
  ForbiddenAction,
  ScaffoldingLevel,
  NcertClass,
  Subject,
  LabSpec,
} from "@/schema/lab-spec";

/* ------------------------------------------------------------------ */
/*  Full wizard state — one slice per LabSpec section                   */
/* ------------------------------------------------------------------ */

export interface WizardState {
  meta: Meta;
  curriculum_alignment: CurriculumAlignment;
  variables: Variable[];
  rules: Rule[];
  decision_tables: DecisionTable[];
  provocation: Provocation;
  ncl: Ncl;
  investigation: Investigation;
  analysis: Analysis;
  discussion: Discussion;
  reflection: Reflection;
  assessment: Assessment;
  ai_tutor_config: AiTutorConfig;
}

/* ------------------------------------------------------------------ */
/*  Step definition                                                     */
/* ------------------------------------------------------------------ */

export interface WizardStep {
  id: string;
  label: string;
  shortLabel: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: "about", label: "About the Lab", shortLabel: "About" },
  { id: "science", label: "Science Model", shortLabel: "Science" },
  { id: "phases", label: "Lab Phases", shortLabel: "Phases" },
  { id: "tutor", label: "AI Tutor & Assessment", shortLabel: "Tutor" },
];

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

export function emptyWizardState(): WizardState {
  return {
    meta: {
      topic: "",
      ncert_class: 8 as NcertClass,
      subject: "physics" as Subject,
      chapter_reference: "",
      estimated_duration_minutes: 60,
      authors: [""],
      spec_version: "0.1.0",
    },
    curriculum_alignment: {
      learning_outcomes: [""],
      prior_knowledge_assumed: [""],
    },
    variables: [],
    rules: [],
    decision_tables: [],
    provocation: {
      real_life_scenario: "",
      curiosity_hook: "",
      motivating_question: "",
      scaffolding_level: "high" as ScaffoldingLevel,
    },
    ncl: {
      concepts_required: [""],
      key_terms: [{ term: "", definition: "" }],
      scaffolding_level: "high" as ScaffoldingLevel,
    },
    investigation: {
      orientation_prompt: "",
      questioning_prompts: [""],
      hypothesis_scaffolds: [""],
      explorable_variables: [],
      experiments: [],
      data_interpretation_prompts: [""],
      scaffolding_level: "medium" as ScaffoldingLevel,
    },
    analysis: {
      guiding_questions: [""],
      expected_patterns: [""],
      scaffolding_level: "medium" as ScaffoldingLevel,
    },
    discussion: {
      discussion_prompts: [""],
      peer_interaction_type: "",
      scaffolding_level: "medium" as ScaffoldingLevel,
    },
    reflection: {
      reflection_prompts: [""],
      metacognitive_prompts: [""],
      scaffolding_level: "low" as ScaffoldingLevel,
    },
    assessment: {
      rubric: [{ criterion: "", levels: ["", "", ""] }],
      formative_checks: [""],
    },
    ai_tutor_config: {
      allowed_actions: [
        "hint",
        "rephrase_question",
        "encourage",
        "socratic_prompt",
        "summarize_student_reasoning",
      ] as AllowedAction[],
      forbidden_actions: [
        "compute_science",
        "state_scientific_fact",
        "give_final_answer",
      ] as ForbiddenAction[],
      fallback_when_asked_science: "",
    },
  };
}

/** Convert WizardState to the LabSpec shape the save action expects. */
export function wizardStateToLabSpec(state: WizardState): LabSpec {
  return {
    meta: state.meta,
    curriculum_alignment: state.curriculum_alignment,
    science_model: {
      variables: state.variables,
      rules: state.rules,
      decision_tables:
        state.decision_tables.length > 0
          ? state.decision_tables
          : [],
    },
    provocation: state.provocation,
    ncl: state.ncl,
    investigation: state.investigation,
    analysis: state.analysis,
    discussion: state.discussion,
    reflection: state.reflection,
    assessment: state.assessment,
    ai_tutor_config: state.ai_tutor_config,
  };
}
