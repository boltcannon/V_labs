# vlab-framework

A teacher-oriented framework for AI-enabled virtual science labs, aligned to
NCERT Classes 6–10. **The framework is the research contribution; a single
lab is one instance produced by the framework.**

Every scientific outcome comes from a deterministic rule engine, not an LLM.
Teachers author a lab by filling in a structured YAML file — no code.

## Getting started

```bash
npm install
npm test          # 56 tests, ~2s
npm run typecheck # tsc --noEmit
```

Worked examples: `src/specs/class-6-biology-habitat-explorer.yaml`,
`src/specs/class-9-physics-motion.yaml`.

## Authoring a new lab (one page)

Copy one of the worked examples and edit. Here is the minimum viable
skeleton with all required sections; comments explain each field.

```yaml
meta:
  topic: "Your topic"                # what this lab is about
  ncert_class: 8                     # one of: 6, 7, 8, 9, 10
  subject: chemistry                 # physics | chemistry | biology | integrated-science
  chapter_reference: "NCERT Class 8, Chapter X: Y"
  estimated_duration_minutes: 90
  authors: ["You"]
  spec_version: "0.1.0"

curriculum_alignment:
  learning_outcomes:                 # verbatim from NCERT LO document
    - "Verbatim NCERT learning outcome 1."
  prior_knowledge_assumed:
    - "What the student is expected to know already."

science_model:
  variables:
    - id: input_x                    # snake_case ids
      label: "Input X"
      type: number                   # number needs range
      unit: "s"
      range: [0, 100]
      role: input                    # input | output | derived
    - id: result_y
      label: "Result Y"
      type: number
      unit: "m"
      range: [0, 1000]
      role: output
  rules:
    - id: compute_y
      description: "How Y depends on X."
      expression: "result_y = input_x * 2"     # OR use decision_table_ref
      validated_by: "NCERT Ch X, §Y"
  # decision_tables:                 # optional; for categorical outcomes

provocation:
  real_life_scenario: "A concrete situation the student recognises."
  curiosity_hook: "The paradox or surprise."
  motivating_question: "The question this lab answers."
  scaffolding_level: high

ncl:                                 # New Content Learning
  concepts_required: ["Concept 1"]
  key_terms:
    - term: "Term"
      definition: "Plain-language definition."
  scaffolding_level: high

investigation:
  orientation_prompt: "What the student can do in the lab."
  questioning_prompts: ["A prompting question."]
  hypothesis_scaffolds: ["If ___ then ___ because ___."]
  explorable_variables: [input_x]    # must reference declared variables
  experiments:
    - id: exp1
      goal: "What this experiment demonstrates."
      controlled_vars: []
      manipulated_vars: [input_x]
      measured_vars: [result_y]
      exercises_rules: [compute_y]   # optional; must resolve to declared rule ids
  data_interpretation_prompts: ["What patterns did you notice?"]
  scaffolding_level: medium

analysis:
  guiding_questions: ["A guiding question."]
  expected_patterns: ["What the AI tutor may check the answer against."]
  scaffolding_level: medium

discussion:
  discussion_prompts: ["A discussion prompt."]
  peer_interaction_type: "pair-and-share"
  scaffolding_level: medium

reflection:
  reflection_prompts: ["What did you find?"]
  metacognitive_prompts: ["How did you approach this?"]
  scaffolding_level: low             # scaffolding fades

assessment:
  rubric:
    - criterion: "Criterion name."
      levels: ["Low", "Mid", "High"]
  formative_checks: ["A check the teacher can run mid-lab."]

ai_tutor_config:
  allowed_actions: [hint, rephrase_question, encourage, socratic_prompt, summarize_student_reasoning]
  forbidden_actions: [compute_science, state_scientific_fact, give_final_answer]
  fallback_when_asked_science: "The exact string the tutor uses when asked for a fact."
```

Save to `src/specs/class-N-<subject>-<slug>.yaml`, then run the tests.
The loader will validate your spec and print a list of any issues.

## Testing your spec

```bash
npm test          # runs all tests, including the loader against every spec
```

To test only your new spec, add a scenario to `tests/engine.test.ts`
following the pattern in the Class 9 or Class 6 blocks.

## Common mistakes

- **Undeclared variable reference.** Every `explorable_variables`,
  `controlled_vars`, `manipulated_vars`, `measured_vars`, decision-table
  `inputs`/`output`, and expression free variable must resolve to a
  declared `science_model.variables[].id`. Zod will name the offender.
- **Number variable with no `range`, or categorical with no `options`.**
  Both are required. Boolean variables must have neither.
- **Two rules producing the same variable.** Ambiguous — the engine can't
  pick which one wins. Merge them or make one produce a derived variable
  the other consumes.
- **Rule that writes to an `input`-role variable.** Inputs come from the
  student. Change the role to `output` or `derived` if you want the engine
  to produce it.
- **Cycles in rule dependencies.** If rule A's output feeds rule B and B's
  output feeds A, the engine refuses to run and names both rules in the
  error message. Rework one rule to break the cycle.
- **Expression not of the form `target = expression`.** Every expression
  rule must assign to a single variable id on the left of a single `=`.
  `y = x + 1` — good. `x + 1 = y`, `y == x`, `x` — rejected.
- **Both `expression` and `decision_table_ref` on one rule** (or neither).
  A rule declares exactly one.
- **NCERT strings.** Every `chapter_reference`, learning outcome, and
  `validated_by` string in the worked examples carries a
  `# TODO(ncert-verify)` tag. When you author a new spec, reconcile these
  against your NCERT copy and remove the tag once verified. Grep with
  `grep -n "TODO(ncert-verify)" src/specs/*.yaml`.

## Design docs

- `docs/architecture.md` — how truth flows from YAML → loader → engine →
  UI/AI tutor, and the type-system boundary that prevents the AI from
  computing science.
- `docs/principle-mapping.md` — table of the nine framework principles,
  the files that enforce each, and the tests that verify each.
- `docs/content-todos.md` — content-level TODOs that the schema and
  engine cannot catch.
- `src/schema/schema-rationale.md` — why every top-level LabSpec section
  exists, one paragraph each.

## What this framework does NOT do (yet)

- No UI. `runLab(spec, inputs)` returns a data structure; a UI comes next.
- No AI tutor. The `ai_tutor_config` block is a policy contract for the
  tutor that will land in a later prompt.
- No persistence. Runs are transient; state management is a UI concern.
- No unit checking. Variables carry a `unit` string but the engine does
  not check dimensional consistency in expressions.
