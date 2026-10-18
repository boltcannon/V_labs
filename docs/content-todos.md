# Content TODOs (spec-level, pre-viva)

Running list of *content* problems the schema and engine cannot catch —
things that need a human (Umang, an SME, or an NCERT reference) to reconcile.
Distinct from the `# TODO(ncert-verify)` inline tags, which cover verbatim
citation strings only.

## Class 6 · Biology · Habitat Explorer

- **`adaptation_fit_table` fall-through cases.** The table enumerates only
  the "obvious" combinations. Legitimate biology combinations that are not
  listed — e.g. `habitat=aquatic, organism_class=fish, water_storage=true`
  (a fish that "stores water" is nonsensical but structurally valid) —
  currently fall through to the `borderline` default rather than being
  called `well_adapted` or `poorly_adapted` on their own merits. Before
  viva, either:
  - Expand the table to cover every reasonable combination and remove the
    `borderline` default, OR
  - Keep `borderline` as a first-class output category and make the
    student's job to argue why the engine's "borderline" call is
    defensible (turning the shortcoming into a pedagogical prompt).

- **Organism classifier is intentionally coarse** (6 rows). A viva reviewer
  may ask why `feathers + legs` (a chicken) does not classify to `bird`.
  Either widen the classifier or state in the discussion that the lab is
  demonstrative, not exhaustive.

## Class 9 · Physics · Motion

- **Speed tolerance = 0.001 m/s.** The `speeds_equal` derived flag uses
  `abs(speed_leg1 - speed_leg2) < 0.001`. This tolerance is a floating-
  point noise guard, not a pedagogical parameter — the student never sees
  it. If a reviewer asks about the "cutoff for uniform motion", the
  honest answer is that it is a numerical hygiene threshold; make sure
  Umang can defend that.

- **No units in the engine.** All numbers are in SI (m, s, m/s) by
  convention; the schema records the unit string on each variable but the
  engine doesn't check consistency. If a teacher writes `distance =
  speed * time` with mixed units, the engine won't catch it. Consider a
  future `unit_of(expression)` check.

## Both specs

- The `# TODO(ncert-verify)` tags in the YAML mark every string that
  should be reconciled against the physical NCERT chapter before viva.
  `grep -n "TODO(ncert-verify)" src/specs/*.yaml` lists them.
