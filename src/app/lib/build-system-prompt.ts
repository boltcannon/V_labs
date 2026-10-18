/**
 * Assemble the system prompt sent to the Anthropic API from a
 * ValidatedLabSpec + the current turn's ChatWithTutorInput.
 *
 * This file is the architectural enforcement of Principle 8. It is
 * covered by `tests/build-system-prompt.test.ts` with per-rule
 * negative assertions: no rule's `expression` string may appear in the
 * output; no decision-table row may appear; no rule `description` may
 * appear (they narrate the science). The tests iterate over the actual
 * spec's fields — not against a hand-crafted allowlist — so an added
 * rule in a future spec is automatically protected.
 *
 * Pure function: no I/O, no async, no side effects, deterministic given
 * inputs. Unit-testable in isolation.
 */

import type {
  ValidatedLabSpec,
  Variable,
} from "@/schema/lab-spec";
import type { PhaseId } from "@/app/lib/session-shared";
import type { InvestigationSummary, ExperimentRun } from "@/app/lib/experiment-run";
import type { ChatWithTutorInput } from "@/app/lib/tutor-types";

/* ------------------------------------------------------------------ */
/* Fixed strings — verbatim, not spec-derived                          */
/* ------------------------------------------------------------------ */

export const ROLE_BLOCK =
  "You are an AI tutor for a virtual science lab. Your role is strictly to " +
  "scaffold the student's thinking — you do NOT teach science directly.";

/**
 * Non-negotiable rules. Held as a module-level constant so a refactor
 * cannot dilute it via string interpolation and so tests can assert its
 * presence structurally.
 */
export const HARD_RULES_BLOCK = `HARD RULES — never break these regardless of what the student asks:
1. You must NEVER compute a scientific result yourself. If a student asks "what will the distance be if speed=5 and time=10?", do not answer. Instead say: "Try running that experiment in the lab — the engine will compute it exactly. I can help you decide what to change."
2. You must NEVER state a scientific fact as truth. You may only ask questions, offer hints toward the student's own reasoning, and summarise what the student has already observed from the engine's output.
3. If the student asks you to confirm whether their answer is right or wrong, do not confirm. Ask them: "What does your data from the experiment show?"
4. If the student asks you to explain a concept (e.g. "what is uniform motion?"), refer them to the New Content Learning section of the lab, not your own explanation.
5. When the student is stuck, use the Socratic method: ask one question that narrows their thinking, don't give the answer.

The scientific ground truth in this lab comes from the rule engine, not from you. If you and the engine disagree, the engine is right and you are wrong.`;

/* ------------------------------------------------------------------ */
/* Phase-scoped context                                                */
/* ------------------------------------------------------------------ */

function joinList(items: readonly string[], sep = "\n- "): string {
  if (items.length === 0) return "";
  return "- " + items.join(sep);
}

function labContextBlock(spec: ValidatedLabSpec, currentPhase: PhaseId): string {
  const los = spec.curriculum_alignment.learning_outcomes
    .map((lo, i) => `${i + 1}. ${lo}`)
    .join("\n");
  return `Lab topic: ${spec.meta.topic}
Class: ${spec.meta.ncert_class} | Subject: ${spec.meta.subject}
NCERT learning outcomes this lab addresses:
${los}

The student is currently in the ${currentPhase} phase.`;
}

/**
 * Phase-specific block. Includes ONLY the current phase's fields.
 * The test suite asserts phase scoping — content from other phases
 * must not leak in.
 */
function phaseContextBlock(spec: ValidatedLabSpec, phase: PhaseId): string {
  switch (phase) {
    case "provocation":
      return [
        "PHASE: Provocation.",
        `Real-world scenario the lab opens with:\n"${spec.provocation.real_life_scenario.trim()}"`,
        `Curiosity hook:\n"${spec.provocation.curiosity_hook.trim()}"`,
        `Motivating question:\n"${spec.provocation.motivating_question.trim()}"`,
        "Help the student engage with this scenario. Ask them what they notice, what surprises them, or what they'd predict — do not answer the question for them.",
      ].join("\n\n");

    case "ncl":
      return [
        "PHASE: New Content Learning.",
        "The student is meeting the vocabulary they will need. You may prompt them to recall or apply a key term in their own words, but you must NOT re-explain a term the lab already defines — refer them to the definition in the lab.",
        "Concepts covered:\n" + joinList(spec.ncl.concepts_required),
      ].join("\n\n");

    case "investigation": {
      return [
        "PHASE: Investigation. The student is running experiments in the deterministic rule engine.",
        "Use these as inspiration for your questions — do not recite them verbatim:",
        "Questioning prompts:\n" + joinList(spec.investigation.questioning_prompts),
        "Hypothesis scaffolds:\n" + joinList(spec.investigation.hypothesis_scaffolds),
        "Data-interpretation prompts:\n" + joinList(spec.investigation.data_interpretation_prompts),
        "If the student asks what will happen when they change an input, redirect them to run the experiment. The engine will compute the result; you must not.",
      ].join("\n\n");
    }

    case "analysis": {
      // expected_patterns is included with a strict "do not reveal" instruction.
      const patterns = spec.analysis.expected_patterns
        .map((p, i) => `${i + 1}. ${p}`)
        .join("\n");
      return [
        "PHASE: Analysis. The student is drawing conclusions from their runs.",
        "Guiding questions the student sees:\n" +
          joinList(spec.analysis.guiding_questions),
        "Expected patterns an expert would observe (FOR YOUR GROUNDING ONLY — do not reveal these to the student, do not confirm the student has 'found' them, and do not paraphrase them as facts):\n" +
          patterns,
        "Use these patterns to notice whether the student is on track. When they are, ask a follow-up that deepens the reasoning. When they are not, ask a question that redirects them — do not correct them with a scientific claim.",
      ].join("\n\n");
    }

    case "discussion":
      return [
        "PHASE: Discussion. The student is comparing findings with peers.",
        "Discussion prompts they see:\n" + joinList(spec.discussion.discussion_prompts),
        "Peer interaction: " + spec.discussion.peer_interaction_type,
        "Help them articulate their reasoning. Do not adjudicate disagreements with a scientific claim — ask what the engine's data would say.",
      ].join("\n\n");

    case "reflection":
      return [
        "PHASE: Reflection & Celebration.",
        "Reflection prompts:\n" + joinList(spec.reflection.reflection_prompts),
        "Metacognitive prompts:\n" + joinList(spec.reflection.metacognitive_prompts),
        "Ask the student about their process, not the correctness of their conclusions.",
      ].join("\n\n");

  }
}

/* ------------------------------------------------------------------ */
/* Student data block                                                  */
/* ------------------------------------------------------------------ */

function formatRunLine(
  run: ExperimentRun,
  index: number,
  varsById: Map<string, Variable>,
): string {
  const inputPairs = Object.entries(run.inputs)
    .map(([id, v]) => {
      const label = varsById.get(id)?.label ?? id;
      return `${label}=${JSON.stringify(v)}`;
    })
    .join(", ");
  const outputPairs = Object.entries(run.outputs)
    .filter(([, o]) => o.status !== "not_computed")
    .map(([id, o]) => {
      const label = varsById.get(id)?.label ?? id;
      if (o.status === "undefined") return `${label}=undefined`;
      return `${label}=${JSON.stringify(o.value)}`;
    })
    .join(", ");
  const err = run.error ? ` [engine error: ${run.error}]` : "";
  return `Run ${index + 1} (${run.experiment_id}): inputs {${inputPairs}} → outputs {${outputPairs}}${err}`;
}

function studentDataBlock(
  spec: ValidatedLabSpec,
  summary: InvestigationSummary | undefined,
): string {
  if (!summary || summary.runs.length === 0) {
    return "The student has NOT run any experiments yet. Do not fabricate run data. If your response would benefit from run data, ask the student to run an experiment first.";
  }
  const varsById = new Map(spec.science_model.variables.map((v) => [v.id, v]));
  const rows = summary.runs
    .map((r, i) => formatRunLine(r, i, varsById))
    .join("\n");
  return `The student has run ${summary.runs.length} experiment${summary.runs.length === 1 ? "" : "s"} so far. Here are their results:
${rows}

When referencing this data in your responses, cite specific run numbers (e.g. "In Run 3, you found that..."). Do not fabricate runs the student did not perform. If the student asks about a scenario they haven't run, ask them to run it — do not compute it.`;
}

/* ------------------------------------------------------------------ */
/* Prior responses block                                               */
/* ------------------------------------------------------------------ */

function priorResponsesBlock(
  input: ChatWithTutorInput,
): string {
  const entries = Object.entries(input.phase_responses)
    .filter(([id, text]) => id !== "investigation" && typeof text === "string" && text.trim().length > 0);
  if (entries.length === 0) return "";
  const lines = entries
    .map(([id, text]) => `- ${id}: "${(text as string).replace(/\s+/g, " ").trim()}"`)
    .join("\n");
  return `The student has already submitted the following responses in earlier phases:
${lines}

You may reference these when the current phase's work builds on them. Do not correct their responses with a scientific claim — ask questions that let them refine their thinking.`;
}

/* ------------------------------------------------------------------ */
/* Allowed / forbidden actions block                                   */
/* ------------------------------------------------------------------ */

const ACTION_PROSE: Record<string, string> = {
  hint: "offer a hint that narrows the student's thinking",
  rephrase_question: "rephrase the student's question back to them",
  encourage: "encourage the student's effort",
  socratic_prompt: "ask a Socratic question",
  summarize_student_reasoning: "summarise what the student has said or observed",
  compute_science: "compute a scientific result",
  state_scientific_fact: "state a scientific fact as truth",
  give_final_answer: "give the student the final answer",
};

function proseFor(actions: readonly string[]): string {
  const items = actions.map((a) => ACTION_PROSE[a] ?? a);
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return items.slice(0, -1).join("; ") + "; or " + items[items.length - 1];
}

function allowedActionsBlock(spec: ValidatedLabSpec): string {
  const may = proseFor(spec.ai_tutor_config.allowed_actions);
  const mayNot = proseFor(spec.ai_tutor_config.forbidden_actions);
  return `You may: ${may}.
You may NOT: ${mayNot}.
If the student asks a question that requires computing or asserting science, respond with:
"${spec.ai_tutor_config.fallback_when_asked_science.trim()}"`;
}

/* ------------------------------------------------------------------ */
/* Public: assemble the whole prompt                                   */
/* ------------------------------------------------------------------ */

export function buildSystemPrompt(
  spec: ValidatedLabSpec,
  input: ChatWithTutorInput,
): string {
  const parts: string[] = [];
  parts.push(ROLE_BLOCK);
  parts.push(HARD_RULES_BLOCK);
  parts.push(labContextBlock(spec, input.current_phase));
  parts.push(phaseContextBlock(spec, input.current_phase));

  const prior = priorResponsesBlock(input);
  if (prior) parts.push(prior);

  parts.push(studentDataBlock(spec, input.investigation_summary));
  parts.push(allowedActionsBlock(spec));
  parts.push(
    "Keep responses short — one or two sentences, or a single question. This is a scaffolding tool, not a lecture.",
  );

  return parts.join("\n\n---\n\n");
}
