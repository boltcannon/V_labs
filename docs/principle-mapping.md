# Principle mapping

For each of the nine non-negotiable design principles, this table names the
source file(s) that *enforce* the principle and the test file(s) that
*verify* it. If a viva examiner asks "how do you know your framework
actually delivers principle N", this is the answer.

| # | Principle                                             | Enforced in                                                                                                                        | Verified in                                                                                                    |
|---|-------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| 1 | Deterministic truth (rule engine, never LLM)          | `src/engine/rule-engine.ts` (pure function of `(spec, inputs)`, no `fetch`/`eval`/LLM); `src/engine/expression-evaluator.ts` (AST parser, `eval` forbidden) | `tests/engine.test.ts` (numerical correctness on both YAMLs); `tests/decision-table.test.ts`                    |
| 2 | NCERT alignment                                       | `src/schema/lab-spec.ts` `Meta.chapter_reference`, `curriculum_alignment.learning_outcomes`; each `Rule.validated_by`                | `tests/principles.test.ts` (`principle 2` block); inline `# TODO(ncert-verify)` tags for pre-viva reconciliation |
| 3 | Real-life framing                                     | `src/schema/lab-spec.ts` `Provocation.real_life_scenario` (required, non-empty)                                                    | `tests/principles.test.ts` (`principle 3` block)                                                                |
| 4 | Full inquiry cycle (Pedaste)                          | `src/schema/lab-spec.ts` `Investigation` sub-fields (`orientation_prompt`, `questioning_prompts`, `hypothesis_scaffolds`, `experiments`, `data_interpretation_prompts`) | `tests/principles.test.ts` (`principle 4` block)                                                                |
| 5 | Fading scaffolding                                    | `src/schema/lab-spec.ts` `scaffolding_level` on `Provocation`, `Ncl`, `Investigation`, `Analysis`, `Discussion`, `Reflection`      | `tests/principles.test.ts` (`principle 5` block — provocation/ncl high, reflection low)                         |
| 6 | Managed cognitive load                                | `src/schema/lab-spec.ts` per-stage separation (Provocation, NCL, Investigation, …) — each stage carries only its own fields          | Reviewed structurally; no dedicated test (structural invariant)                                                 |
| 7 | Motivational hooks                                    | `src/schema/lab-spec.ts` `Provocation.curiosity_hook`, `motivating_question`; experiment goals in `Investigation`                    | `tests/principles.test.ts` (`principle 7` block)                                                                |
| 8 | AI never invents science                              | `src/schema/lab-spec.ts` `ValidatedLabSpec` brand + `asValidatedLabSpec`; `src/engine/rule-engine.ts` `runLab(spec: ValidatedLabSpec, …)`; `AiTutorConfig.forbidden_actions` | `tests/brand.test.ts` (compile-time refusal of hand-built spec via `@ts-expect-error`); `tests/principles.test.ts` (`principle 8` block — forbidden list content) |
| 9 | Teacher-authorable (YAML)                             | `src/specs/*.yaml` (worked examples); `src/loader/spec-loader.ts` (YAML → typed); `src/schema/lab-spec.zod.ts` (readable error messages) | `tests/loader.test.ts`; `tests/schema.test.ts` (negative cases surface specific messages)                       |

## Additional invariants enforced by the schema

These aren't standalone principles, but they're structural rules the schema
enforces to keep the framework's guarantees intact:

| Invariant                                                     | Where                                                                                     | Test                                                                                     |
|---------------------------------------------------------------|-------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| One rule per output variable                                  | `src/schema/lab-spec.zod.ts` `scienceModelSchema.superRefine`                             | `tests/schema.test.ts` — "rejects two rules producing the same variable"                 |
| Rules cannot write to `input`-role variables                  | `src/schema/lab-spec.zod.ts` `scienceModelSchema.superRefine`                             | `tests/schema.test.ts` — "rejects a rule that writes to an input-role variable"          |
| Every explorable and experiment variable id resolves          | `src/schema/lab-spec.zod.ts` `labSpecSchema.superRefine`                                  | `tests/schema.test.ts`; `tests/principles.test.ts` (`principle 9` block)                 |
| `exercises_rules` ids resolve to declared rules               | `src/schema/lab-spec.zod.ts` `labSpecSchema.superRefine`                                  | `tests/schema.test.ts` — "rejects exercises_rules pointing at an unknown rule id"        |
| Rules run in topological order; cycles refused with named ids | `src/engine/rule-engine.ts` `topologicalSort` + `CycleError`                              | `tests/engine-topology.test.ts` — both order and cycle-naming                             |
| Undefined outcomes never leak as NaN/Infinity                 | `src/engine/rule-engine.ts` status propagation; `src/engine/expression-evaluator.ts` `Number.isFinite` guard | `tests/engine-undefined.test.ts` — 8 tests covering zero-time, both-zero, NaN input, propagation |
