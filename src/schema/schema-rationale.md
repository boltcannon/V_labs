# LabSpec — why each section exists

This is the design brief for the LabSpec schema. One paragraph per top-level
section: what it is, which of the nine framework principles it enforces, and
what it deliberately leaves out. The schema itself lives in `lab-spec.ts`
(types) and `lab-spec.zod.ts` (runtime validation, cross-field checks).

## `meta`
Identity block. Topic, NCERT class (6–10, strictly typed), subject, chapter
reference, expected duration, authors, and a `spec_version` string. Its job
is to make one spec distinguishable from another in a library of hundreds,
and to give the loader a version marker so future schema evolutions can be
migrated without breaking archived labs. Enforces **Principle 2 (NCERT
alignment)** at the identity level — a spec that cannot name its NCERT
chapter fails validation.

## `curriculum_alignment`
Verbatim NCERT learning outcomes plus a `prior_knowledge_assumed` list.
This section is the framework's contract with the teacher: the science and
activities in the rest of the spec must be traceable to these outcomes.
Enforces **Principle 2 (NCERT alignment)** directly. Deliberately holds the
strings verbatim rather than referring to an external code list — the
teacher must be able to read the LO the lab is training against, without a
lookup.

## `science_model`
The declarative model the rule engine consumes. Three parts:
- `variables` — everything the student can manipulate or observe, plus
  outputs the engine computes and derived intermediates. Each variable
  carries a type (`number` / `categorical` / `boolean`), a role (`input` /
  `output` / `derived`), and — for numbers — a `range`, or for categoricals
  a set of `options`. Cross-field Zod checks reject a `number` without a
  range, a `categorical` without options, and any mismatched combination.
- `rules` — each rule is either a math `expression` (`distance = speed *
  time`) OR a reference to a decision table (`decision_table_ref`). XOR is
  enforced at validation time. Every rule carries a `validated_by` string
  citing the NCERT chapter or SME who approved the relationship.
- `decision_tables` — first-match categorical rules with optional default.
  All input and output variable ids must resolve to declared variables.

This section is the mechanical guarantor of **Principle 1 (deterministic
truth)** — every scientific outcome originates here — and, together with
`ai_tutor_config`, of **Principle 8 (AI never invents science)**. The
schema also enforces "one rule per output variable" and "rules cannot write
to input-role variables", so the topological sort in the engine is
unambiguous.

## `provocation`
Real-life scenario, curiosity hook, motivating question. The pedagogical
entry point for the student: what makes this worth their attention?
Enforces **Principle 3 (real-life framing)** — the schema requires the
`real_life_scenario` field to be non-empty — and **Principle 7 (motivation)**
via `curiosity_hook` and `motivating_question`. Carries a
`scaffolding_level: high` because at this stage the student needs
maximum support.

## `ncl` (New Content Learning)
Concepts required to attempt the lab, plus key terms with definitions. This
is where the teacher declares "the student is expected to know these words
before we begin, and if they don't, here's the definition." Enforces
**Principle 6 (managed cognitive load)** by front-loading vocabulary before
Investigation, and continues the `high` scaffolding phase.

## `investigation`
Where Pedaste's inquiry cycle runs inside the outer 9-phase shell. Sub-fields
map to the sub-phases: `orientation_prompt` (Orientation),
`questioning_prompts` and `hypothesis_scaffolds` (Conceptualization),
`experiments` and `data_interpretation_prompts` (Investigation proper), with
`explorable_variables` referencing declared variables the student may
manipulate. Enforces **Principle 4 (full inquiry cycle)** by requiring every
sub-phase to be populated. Each experiment records
`controlled_vars`/`manipulated_vars`/`measured_vars` and an optional
`exercises_rules` list — the latter is the coverage claim used by later
tests and by the AI tutor's grounding layer. Scaffolding drops to `medium`.

## `analysis`
Guiding questions plus `expected_patterns` — patterns the AI tutor is
ALLOWED to check a student's answer against, never to generate for them.
This is the schema's fine-grained knob for **Principle 8**: the tutor may
retrieve from this list, but may not synthesize its own patterns. Scaffolding
`medium`.

## `discussion`
Discussion prompts and the peer-interaction shape (pair, group of 4,
whole-class). This is the Discussion phase that Pedaste runs in parallel
with the inquiry cycle. Its scaffolding is `medium`.

## `reflection`
Reflection prompts and metacognitive prompts. Deliberately separated:
reflection asks "what did you find?", metacognition asks "how did you
think about finding it?". Scaffolding drops to `low` — by this stage the
student is expected to work with minimal support. Enforces **Principle 5
(fading scaffolding)**.

## `assessment`
Rubric (criterion + ordered levels) and formative checks. This is what a
teacher will use to grade or to guide mid-lab observation. Carries no
scaffolding level — it is teacher-facing, not student-facing.

## `ai_tutor_config`
Explicit allow-list and forbid-list for AI tutor actions, plus a
`fallback_when_asked_science` string the tutor uses verbatim when a student
asks for a scientific answer. The forbid-list must contain `compute_science`,
`state_scientific_fact`, and `give_final_answer` in every valid spec — this
is checked by the `principles.test.ts` meta-tests. The Zod validator also
refuses any overlap between the allowed and forbidden lists.

This section is the *policy* half of **Principle 8**; the *mechanical* half
is the `ValidatedLabSpec` brand in `lab-spec.ts` — the engine's public API
accepts only a spec that has come through the loader, so an AI tutor cannot
hand-construct a spec and call `runLab` to get science out.
