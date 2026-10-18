# CLAUDE.md — SAIL (V_sim_labs)

Read this fully at the start of every session. If anything here conflicts with code, the code is the fact; report the conflict, do not silently "fix" either side.

## 1. What this project is

SAIL (Scaffolded AI-enabled Inquiry Labs) is the M.Tech thesis (MTP) of Umang Gupta, Centre for Educational Technology, IIT Bombay. Guide: Prof. Sahana Murthy.

* A framework for building AI-enabled virtual science labs for Indian school classrooms (NCERT and state boards).
* The FRAMEWORK is the contribution. Individual labs are exemplars that show the framework works.
* Core design rule: scientific outcomes come from a deterministic rule engine. The AI tutor only scaffolds (hints, questions, encouragement, rephrasing). It never computes, decides, or states the science.

Timeline: MTP Stage I submission 23 Oct 2026. Teacher authoring study in India Nov–Dec 2026. Kumamoto (Japan) Jan–Apr 2027. Defence May 2027.

## 2. Decided (do not reopen)

* Primary thesis evidence, three metrics:
   1. Guardrail compliance — report raw LLM violation rate, fallback rate, false-block rate, and miss rate on a human-labelled sample. A pipeline grading itself is not enough.
   2. Framework reusability — multiple labs across grades/subjects run on the same engine with no engine code changes.
   3. Teacher configurability — teachers modify or create a lab without writing code.
* NOT claimed: SAIL improves learning compared with traditional labs. Engagement/understanding are secondary, exploratory only.
* Primary user: teachers. Long-term authoring mode: AI-assisted authoring by retrieval + assembly of pre-validated components (the AI never generates the science). This "AI Author" is future work, NOT in scope now.
* First new lab: Class 10 Physics, Electricity (series circuits).

## 3. Open (do NOT decide these; ask Umang)

* Learner agency version: bounded choice of variable, extra-evidence requests, or both.
* Engine location for the interactive stage: server round-trip via runLab() (current default) vs client-side engine (needed for offline use).
* Validation framing: framework-only vs framework + small exploratory student pilot.
* Authoring mode emphasis: AI-assisted authoring vs "template + configure" (needs-analysis data favours the lighter mode).
* Evolution scope: kept for research reasons, but no interviewed teacher asked for it.

## 4. Evidence that shapes design (needs analysis, 3 teachers)

* None of the 3 asked to author labs; they asked for ready-made, customised labs. Barriers: time (T3), training (T2: "if trained enough, I can do it").
* All 3 reported syllabus/time pressure; periods are ~40 minutes. Target lab duration: 35 minutes.
* 2 of 3 want the AI kept within grade-level content depth.
* All 3 schools were well resourced (not evidence for offline mode).

## 5. Pedagogy reviewer feedback (23 Sep 2026) — accepted

1. Classes 6–8: predictions via choice, sorting, drawing, or short verbal answers, not always written. The POE gate stays.
2. A failed prediction does NOT equal conceptual change. After every discrepant event the student must explain, compare, and revise. Wording must say "opportunity for conceptual revision", never "students give up misconceptions".
3. Add bounded learner agency alongside teacher agency (version still open, see §3).

Technical reviewer said only "draft is well defined"; detailed comments pending.

## 6. Repo facts (baseline)

* Stack: Next.js (App Router), TypeScript, Zod, YAML specs, Vitest, expr-eval-based expression evaluator. Tutor calls an external LLM (Groq).
* Baseline: 140 tests passing across 13 files. Baseline commit `0b46d1f`.
* Specs in `src/specs/`: class-6 biology habitat explorer (categorical, decision tables), class-8 physics pressure (numeric), class-9 physics motion (numeric, multi-run).
* `src/schema/lab-spec.ts` is the source of truth; `lab-spec.zod.ts` mirrors it. `NcertClass` currently allows 6–10.
* `ValidatedLabSpec` is a phantom brand. Only the loader produces it via `asValidatedLabSpec()`. Never weaken this.
* `PublicLabSpec` redacts rules and decision tables before reaching the client. Rules reach the client only via server-side `runLab()` (verify).
* The repo's 9 principles (`src/schema/schema-rationale.md`) are an earlier set and differ from the thesis's current principles. Reconciliation is pending; do not rewrite either without asking.
* IGNORE the `Claude outputs/` folder (old screenshots and a duplicate YAML).
* `.env.local` is gitignored. Never print, commit, or copy its contents.

## 7. Implemented vs designed (be honest in all docs)

Implemented: schema + loader + brand boundary; rule engine (expressions, decision tables, status propagation); tutor with PROMPT-LEVEL rules (3 documented live tests); 9-phase UI shell; authoring wizard; 3 specs.

Designed, NOT implemented: prediction gate; misconception bank and deterministic detectors; discrepant-event checks; typed and fading scaffolds; learner model; inquiry FSM orchestrator; six-check post-hoc response validator; evidence/xAPI logging; offline null-LLM provider (unverified); visual simulation stage.

## 8. Non-negotiable rules

1. Test-first. Keep all existing tests green. Run `npm test` and `npx tsc --noEmit` before reporting a task done.
2. New schema fields are OPTIONAL. The 3 existing specs must load unchanged.
3. No LLM anywhere in misconception detection or prediction matching. Deterministic only.
4. Visual components draw engine outputs only. No physics/maths in UI code.
5. Do not change `ai_tutor_config` semantics or the brand boundary.
6. Stop after each task. Report what changed, test counts, and anything surprising. Wait for approval before the next task.
7. Commit after each approved task with a clear message.
8. If a requirement is ambiguous or conflicts with code, ask. Do not guess.

## 9. Current work: Schema v2 + Electricity lab

Decided 18 Oct 2026: variable ids are lowercase snake_case (`v`, `r1`, `i_series`, …) because the schema id pattern and expression parser reject uppercase; the id pattern stays unchanged.

### Schema v2 additions (all optional)

```yaml
science_model:
  validity_bounds: ["Ideal wires and battery (no internal resistance)", "Bulb resistance treated as constant"]

investigation:
  experiments:
    - id: exp_series_current
      preset: { v: 6, r1: 10, r2: 10 }   # input var ids -> values within range/options

prediction:
  gate: true
  input_mode: choice      # choice | sort | numeric  (no free text in v2)
  items:
    - id: pred_current_after_bulb1
      experiment_ref: exp_series_current
      question: "..."
      options:
        - id: opt_less
          label: "Less than before the bulb"
          correct_when: "i_after_bulb1 < i_before_bulb1"   # engine-evaluated
          maps_to_misconception: m_current_used_up          # nullable

misconceptions:
  - id: m_current_used_up
    statement: "Current is used up as it passes through a bulb."
    source: "Verify: McDermott & Shaffer (1992); Shipstone (1984)"
    detected_when: { prediction_option: opt_less }
    discrepant_event: { experiment_ref: exp_series_current }
    revision:            # all four required
      explain_prompt: "..."
      compare_prompt: "..."
      revise_prompt: "..."
      alternative_model: "..."   # teacher-authored; shown only after a revision attempt; the tutor may not state it

choice_points:
  - id: cp_which_to_test
    prompt: "What do you want to test first?"
    options:
      - { id: cp_current, label: "Current before/after a bulb", routes_to_misconception: m_current_used_up }
      - { id: cp_add_bulb, label: "Adding a second bulb", routes_to_misconception: m_battery_constant_current }
```

### Validator rules (each needs a passing and a failing fixture)

* V1 Misconception references exist; all four revision fields non-empty.
* V2 At each experiment preset, exactly one prediction option's `correct_when` is true.
* V3 At the preset, the misconception-mapped option is false (the event is genuinely discrepant).
* V4 Robustness: sample K seeded points across teacher-configurable ranges of unlocked variables; the mapped option must be false at all of them. On failure, name the point.
* V5 Option ids unique; each maps to at most one misconception.
* V6 Every choice option routes to an existing misconception; every misconception reachable from at least one option.
* V7 If `misconceptions` exists, `prediction.gate` must be true.
* V8 v1 specs load unchanged.

Keep a fixture where a brightness-based prediction with r1 ≠ r2 in range FAILS V4. This is thesis evidence that configuration can break a discrepant event and the validator catches it.

### Electricity lab (Class 10) — "Where does the current go?"

Variables: `v` (input, 1.5–12 V), `r1`, `r2` (input, 5–50 Ω). Derived: `r_series = r1 + r2`; `i_single = v / r1`; `i_series = v / (r1 + r2)`; `i_before_bulb1 = i_series`; `i_after_bulb1 = i_series`; `v1 = i_series * r1`; `v2 = i_series * r2`; `p1 = i_series^2 * r1`; `p2 = i_series^2 * r2`.

* M1 "Current is used up by the bulb." Ask about ammeter reading after bulb 1 (less/same/more). Correct: same, for any r1, r2. Use current, not brightness.
* M2 "The battery always supplies the same current." Adding a second bulb: battery current same/lower/higher. Correct: lower. Two-run experiment; follow how class-9 motion handles multi-run.
* Verify `chapter_reference` against the board textbook.

Golden tests (hand-checked; write before the spec):

* v=6, r1=10, r2=10 → r_series=20, i_series=0.3 A, v1=v2=3 V, p1=p2=0.9 W
* v=6, r1=10, r2=20 → r_series=30, i_series=0.2 A, v1=2 V, v2=4 V, p1=0.4 W, p2=0.8 W
* v=6, r1=10 alone → i_single=0.6 A; with r2=10 → i_series=0.3 A

### Tasks (stop and report after each)

* T0 Report only, no code changes: baseline test count; whether the expression evaluator supports comparison operators and boolean results; how multi-run experiments are specified; whether rules reach the client only via `runLab()`.
* T1 Schema v2 types + Zod + tests.
* T2 Validator V1–V8 with fixtures.
* T3 `class-10-physics-electricity.yaml` + golden tests.
* T4 Prediction gate UI (choice mode), reveal of prediction vs outcome, then the revision prompts.
* T5 Update `docs/principle-mapping.md` (principle → files → tests).
* T6 `CircuitStage` SVG component. Props = engine outputs only. Battery, two bulbs, two ammeters; glow scales with P, ammeter shows I, flow-dot speed scales with I. Sliders call `runLab()` on release. Test: pass absurd but consistent outputs; the display must show them unchanged.

Out of scope now: typed/fading scaffolds, FSM orchestrator, learner model, six-check validator, xAPI pipeline, AI Author, free-text prediction, offline mode.
