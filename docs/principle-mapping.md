# Principle mapping

For each of the nine design principles, this table names the source
file(s) that *enforce* the principle and the test file(s) that *verify*
it. If a viva examiner asks "how do you know your framework actually
delivers principle N", this is the answer.

> **Which principles.** These are the repo's original nine principles
> (`src/schema/schema-rationale.md`). The thesis drafts state a newer set
> (eight principles in the pedagogical validation draft). Reconciling the
> two sets is pending and has not been done here. This page records what
> the code enforces today, including the schema v2 work (prediction gate,
> misconceptions, validator, Class 10 Electricity lab).

Worked examples covered by the cross-spec tests: Class 6 biology, Class 9
physics, Class 10 electricity (`tests/principles.test.ts`,
`tests/build-system-prompt.test.ts`). The Class 8 pressure spec is loaded
and run in `tests/save-lab-spec.test.ts` and `tests/schema-v2.test.ts`.

| # | Principle | Enforced in | Verified in |
|---|-----------|-------------|-------------|
| 1 | Deterministic truth (rule engine, never LLM) | `src/engine/rule-engine.ts` (pure function of `(spec, inputs)`, no `fetch`/`eval`/LLM); `src/engine/expression-evaluator.ts` (AST parser, `eval` forbidden, `random()` removed; `parseCondition`/`evaluateCondition` for prediction conditions); `src/app/lib/resolve-prediction.ts` (a prediction is matched by running the engine at the experiment preset and evaluating each `correct_when` — no LLM) | `tests/engine.test.ts`; `tests/decision-table.test.ts`; `tests/electricity.test.ts` (hand-checked golden values, written before the spec); `tests/resolve-prediction.test.ts` (prediction matching) |
| 2 | NCERT alignment | `src/schema/lab-spec.ts` `Meta.chapter_reference`, `curriculum_alignment.learning_outcomes`; each `Rule.validated_by` | `tests/principles.test.ts` (`principle 2` block, all three worked examples); inline `# TODO(ncert-verify)` tags still open in the Class 6, 9 and 10 specs |
| 3 | Real-life framing | `src/schema/lab-spec.ts` `Provocation.real_life_scenario` (required, non-empty) | `tests/principles.test.ts` (`principle 3` block) |
| 4 | Full inquiry cycle (Pedaste) | `src/schema/lab-spec.ts` `Investigation` sub-fields; schema v2 `Prediction` (gate, items, options). Predict-before-run is enforced in the UI: `src/app/lib/prediction-flow.ts` (choose → commit → reveal → explain → compare → revise) and `src/components/investigation/investigation-shell.tsx` (Run and controls locked until the prediction is done) | `tests/principles.test.ts` (`principle 4` block); `tests/prediction-flow.test.ts` (run stays locked until commit, and after a mismatch until all three revision steps); `tests/spec-validator.test.ts` V7 (misconceptions require `gate: true`) |
| 5 | Fading scaffolding | `src/schema/lab-spec.ts` `scaffolding_level` on `Provocation`, `Ncl`, `Investigation`, `Analysis`, `Discussion`, `Reflection` | `tests/principles.test.ts` (`principle 5` block — provocation/ncl high, reflection low) |
| 6 | Managed cognitive load | `src/schema/lab-spec.ts` per-stage separation — each stage carries only its own fields; Class 10 spec sized to a 35-minute period | Reviewed structurally; `tests/electricity.test.ts` asserts the 35-minute target for the Class 10 lab |
| 7 | Motivational hooks | `src/schema/lab-spec.ts` `Provocation.curiosity_hook`, `motivating_question`; experiment goals in `Investigation` | `tests/principles.test.ts` (`principle 7` block) |
| 8 | AI never invents science | `src/schema/lab-spec.ts` `ValidatedLabSpec` brand + `asValidatedLabSpec`; `src/engine/rule-engine.ts` `runLab(spec: ValidatedLabSpec, …)`; `AiTutorConfig.forbidden_actions`; `src/app/lib/build-system-prompt.ts` (no rule expressions, descriptions or table rows in the tutor prompt); `src/app/lib/to-public-spec.ts` (`PublicLabSpec` drops rules and tables; `toPublicPrediction` drops `correct_when` and misconception mappings); `src/app/lib/resolve-prediction.ts` (`server-only`; `alternative_model` released only after a revision attempt, never to the tutor) | `tests/brand.test.ts` (`@ts-expect-error` refusal of a hand-built spec); `tests/principles.test.ts` (`principle 8` block); `tests/build-system-prompt.test.ts` (per-rule leak checks, all three worked examples); `tests/schema-v2.test.ts` and `tests/resolve-prediction.test.ts` (answer key, misconception ids and `alternative_model` absent from client payloads and tutor prompt) |
| 9 | Teacher-authorable (YAML) | `src/specs/*.yaml`; `src/loader/spec-loader.ts`; `src/schema/lab-spec.zod.ts` (readable messages; schema v2 fields all optional); `src/validator/spec-validator.ts` (V1–V7, each issue with a field path and plain message) | `tests/loader.test.ts`; `tests/schema.test.ts`; `tests/schema-v2.test.ts`; `tests/spec-validator.test.ts`; `tests/save-lab-spec.test.ts` |

## Additional invariants

Structural rules that keep the framework's guarantees intact.

### Schema (v1)

| Invariant | Where | Test |
|-----------|-------|------|
| One rule per output variable | `src/schema/lab-spec.zod.ts` `scienceModelSchema.superRefine` | `tests/schema.test.ts` — "rejects two rules producing the same variable" |
| Rules cannot write to `input`-role variables | `src/schema/lab-spec.zod.ts` `scienceModelSchema.superRefine` | `tests/schema.test.ts` — "rejects a rule that writes to an input-role variable" |
| Every explorable and experiment variable id resolves | `src/schema/lab-spec.zod.ts` `labSpecSchema.superRefine` | `tests/schema.test.ts`; `tests/principles.test.ts` (`principle 9` block) |
| `exercises_rules` ids resolve to declared rules | `src/schema/lab-spec.zod.ts` `labSpecSchema.superRefine` | `tests/schema.test.ts` — "rejects exercises_rules pointing at an unknown rule id" |
| Rules run in topological order; cycles refused with named ids | `src/engine/rule-engine.ts` `topologicalSort` + `CycleError` | `tests/engine-topology.test.ts` |
| Undefined outcomes never leak as NaN/Infinity | `src/engine/rule-engine.ts` status propagation; `src/engine/expression-evaluator.ts` `Number.isFinite` guard | `tests/engine-undefined.test.ts` |

### Schema v2 and the spec validator

| Invariant | Where | Test |
|-----------|-------|------|
| All v2 fields optional; v1 specs load unchanged (V8) | `src/schema/lab-spec.ts`, `src/schema/lab-spec.zod.ts` | `tests/schema-v2.test.ts` — "v1 specs load unchanged"; `tests/spec-validator.test.ts` — V8 |
| Presets name declared `input` variables with type- and range-valid values | `src/schema/lab-spec.zod.ts` `labSpecSchema.superRefine` | `tests/schema-v2.test.ts` — `experiments[].preset` block |
| Every misconception has all four revision fields | `src/schema/lab-spec.zod.ts` `misconceptionSchema`; non-blank re-checked by V1 | `tests/schema-v2.test.ts`; `tests/spec-validator.test.ts` — V1 |
| V1 Misconception references exist and agree | `src/validator/spec-validator.ts` | `tests/spec-validator.test.ts` — V1 |
| V2 Exactly one option true at the experiment preset | `src/validator/spec-validator.ts` (engine-evaluated) | `tests/spec-validator.test.ts` — V2 |
| V3 The misconception-mapped option is false at the preset | `src/validator/spec-validator.ts` | `tests/spec-validator.test.ts` — V3 |
| V4 The mapped option stays false across the unlocked variables' ranges (seeded sampling; failure names the point) | `src/validator/spec-validator.ts`; `src/validator/prng.ts` | `tests/spec-validator.test.ts` — V4, including the brightness fixture; `tests/electricity.test.ts` — the real Class 10 spec asked about brightness fails V4 |
| V5 Unique item and option ids; one misconception per option | `src/validator/spec-validator.ts` | `tests/spec-validator.test.ts` — V5 |
| V6 Choice options route to existing misconceptions; all reachable when choice points exist | `src/validator/spec-validator.ts` | `tests/spec-validator.test.ts` — V6 |
| V7 Misconceptions require `prediction.gate: true` | `src/validator/spec-validator.ts` | `tests/spec-validator.test.ts` — V7 |
| The Class 10 lab passes V1–V7 | `src/specs/class-10-physics-electricity.yaml` | `tests/electricity.test.ts` |
| The loader refuses a spec that fails V1–V7 (so does the wizard's save action, which validates through the same `parseLabSpec`) | `src/loader/spec-loader.ts` `parseLabSpec` | `tests/hardening.test.ts` — "loader — runs the spec validator" |
| No `random()` in expressions — the engine never yields a non-deterministic value | `src/engine/expression-evaluator.ts` (removed from the parser's function table) | `tests/hardening.test.ts` — "random() is not available" |

### Prediction gate (runtime)

| Invariant | Where | Test |
|-----------|-------|------|
| The answer key (`correct_when`) never reaches the browser or the tutor | `src/app/lib/to-public-spec.ts` `toPublicPrediction`; `src/app/lib/resolve-prediction.ts` (`server-only`) | `tests/resolve-prediction.test.ts`; `tests/schema-v2.test.ts` — "answers do not reach the client or the tutor" |
| A run stays locked until a prediction is committed and, after a mismatch, explained, compared and revised | `src/app/lib/prediction-flow.ts`; `src/components/investigation/investigation-shell.tsx` | `tests/prediction-flow.test.ts` (reducer); UI lock checked by a manual browser walkthrough, not an automated test |
| `alternative_model` is released only for a misconception-mapped option and only with a non-blank revision | `src/app/lib/resolve-prediction.ts` `alternativeModelForSpec` | `tests/resolve-prediction.test.ts` — `revealAlternativeModel` block |
| Wording after a mismatch is "opportunity for conceptual revision" | `src/components/investigation/prediction-panel.tsx` | Not tested automatically |

## Not yet enforced

Honest gaps, so the table above is not read as more than it is.

- **Tutor guardrails are prompt-level only.** No post-hoc response validator; evidence is the three live tests in `docs/tutor-behaviour-log.md`.
- **Undeclared names in rule expressions are not rejected at load.** A rule whose right-hand side uses an unknown identifier loads, and fails only when the engine evaluates it. (Prediction conditions are checked: V2 rejects unknown variables.)
- **expr-eval's `if(…)` function is still available,** so a rule can branch even though the `?:` operator is disabled. Not a determinism risk; a design-intent gap.
- **The model-reveal check is stateless.** The server cannot confirm the student actually chose the option or completed the earlier revision steps; it requires only a non-blank revision.
- **Prediction and revision answers are not stored or logged.** They are lost on navigation and are not seen by the tutor or a teacher.
- **Not rendered yet:** choice points, and the `sort` and `numeric` prediction modes.
- **The authoring wizard cannot author schema v2 fields.**
