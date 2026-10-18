"use client";

import { useState, useMemo } from "react";
import type {
  Variable,
  Rule,
  DecisionTable,
  NcertClass,
  Subject,
  ScaffoldingLevel,
  AllowedAction,
  ForbiddenAction,
  KeyTerm,
  RubricCriterion,
  Experiment,
} from "@/schema/lab-spec";
import type { WizardState } from "./wizard-types";
import {
  FormulaPatternPicker,
  type FormulaPickerResult,
} from "./formula-pattern-picker";
import {
  DecisionTableBuilder,
  type DecisionTableResult,
} from "./decision-table-builder";
import { cn } from "@/lib/cn";

/* ================================================================== */
/*  Shared sub-components                                              */
/* ================================================================== */

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-medium text-text">
      {children}
      {hint && (
        <span className="ml-1 text-xs text-text-soft font-normal">
          ({hint})
        </span>
      )}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent resize-y"
    />
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function StringListEditor({
  label,
  hint,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  const add = () => onChange([...items, ""]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, v: string) =>
    onChange(items.map((item, idx) => (idx === i ? v : item)));

  return (
    <div className="space-y-2">
      <FieldLabel {...(hint != null ? { hint } : {})}>{label}</FieldLabel>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <TextInput
            value={item}
            onChange={(v) => update(i, v)}
            {...(placeholder != null ? { placeholder } : {})}
          />
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-red-500 hover:text-red-700 text-xs px-2 transition shrink-0"
            >
              &#10005;
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-sm text-accent hover:text-accent-strong transition"
      >
        + Add
      </button>
    </div>
  );
}

function ScaffoldingLevelPicker({
  value,
  onChange,
}: {
  value: ScaffoldingLevel;
  onChange: (v: ScaffoldingLevel) => void;
}) {
  const levels: ScaffoldingLevel[] = ["high", "medium", "low", "none"];
  return (
    <div className="space-y-1">
      <FieldLabel>Scaffolding Level</FieldLabel>
      <div className="flex gap-2">
        {levels.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onChange(l)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md border transition capitalize",
              value === l
                ? "bg-accent text-text-inverse border-accent"
                : "bg-surface text-text border-surface-border hover:border-accent/40",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-surface-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-muted/50 hover:bg-surface-muted transition text-left"
      >
        <div>
          <span className="text-sm font-semibold text-text">{title}</span>
          {description && (
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          )}
        </div>
        <span className="text-text-soft text-xs shrink-0 ml-2">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && <div className="p-4 space-y-4 border-t border-surface-border">{children}</div>}
    </div>
  );
}

/* ================================================================== */
/*  Step 1: About the Lab (Meta + Curriculum)                          */
/* ================================================================== */

export function StepAbout({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
}) {
  const m = state.meta;
  const ca = state.curriculum_alignment;
  const setM = (patch: Partial<typeof m>) =>
    onChange({ ...state, meta: { ...m, ...patch } });
  const setCa = (patch: Partial<typeof ca>) =>
    onChange({ ...state, curriculum_alignment: { ...ca, ...patch } });

  return (
    <div className="space-y-6">
      <Section title="Basic Information" description="What is this lab about?">
        <div className="space-y-1">
          <FieldLabel>Topic</FieldLabel>
          <TextInput
            value={m.topic}
            onChange={(v) => setM({ topic: v })}
            placeholder="e.g. Pressure and its Effects"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <FieldLabel>NCERT Class</FieldLabel>
            <SelectInput
              value={String(m.ncert_class)}
              onChange={(v) => setM({ ncert_class: Number(v) as NcertClass })}
              options={[6, 7, 8, 9, 10].map((n) => ({
                value: String(n),
                label: `Class ${n}`,
              }))}
            />
          </div>
          <div className="space-y-1">
            <FieldLabel>Subject</FieldLabel>
            <SelectInput
              value={m.subject}
              onChange={(v) => setM({ subject: v as Subject })}
              options={[
                { value: "physics", label: "Physics" },
                { value: "chemistry", label: "Chemistry" },
                { value: "biology", label: "Biology" },
                { value: "integrated-science", label: "Integrated Science" },
              ]}
            />
          </div>
        </div>
        <div className="space-y-1">
          <FieldLabel>Chapter Reference</FieldLabel>
          <TextInput
            value={m.chapter_reference}
            onChange={(v) => setM({ chapter_reference: v })}
            placeholder="e.g. NCERT Science Class 8, Chapter 11: Force and Pressure"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <FieldLabel hint="minutes">Estimated Duration</FieldLabel>
            <TextInput
              value={String(m.estimated_duration_minutes)}
              onChange={(v) =>
                setM({ estimated_duration_minutes: Number(v) || 0 })
              }
              type="number"
            />
          </div>
          <div className="space-y-1">
            <FieldLabel>Spec Version</FieldLabel>
            <TextInput
              value={m.spec_version}
              onChange={(v) => setM({ spec_version: v })}
              placeholder="0.1.0"
            />
          </div>
        </div>
        <StringListEditor
          label="Authors"
          items={m.authors}
          onChange={(v) => setM({ authors: v })}
          placeholder="e.g. Teacher Name (School)"
        />
      </Section>

      <Section
        title="Curriculum Alignment"
        description="What should students learn from this lab?"
      >
        <StringListEditor
          label="Learning Outcomes"
          hint="at least 1"
          items={ca.learning_outcomes}
          onChange={(v) => setCa({ learning_outcomes: v })}
          placeholder="Students will be able to..."
        />
        <StringListEditor
          label="Prior Knowledge Assumed"
          items={ca.prior_knowledge_assumed}
          onChange={(v) => setCa({ prior_knowledge_assumed: v })}
          placeholder="Understands..."
        />
      </Section>
    </div>
  );
}

/* ================================================================== */
/*  Step 2: Science Model (Variables + Rules + Decision Tables)        */
/* ================================================================== */

function VariableEditor({
  variable,
  onChange,
  onRemove,
}: {
  variable: Variable;
  onChange: (v: Variable) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<Variable>) =>
    onChange({ ...variable, ...patch });

  return (
    <div className="rounded-lg border border-surface-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-accent">
          {variable.id || "new_variable"}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 text-xs transition"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <FieldLabel hint="snake_case">ID</FieldLabel>
          <TextInput
            value={variable.id}
            onChange={(v) => set({ id: v })}
            placeholder="e.g. pressure"
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Label</FieldLabel>
          <TextInput
            value={variable.label}
            onChange={(v) => set({ label: v })}
            placeholder="e.g. Pressure"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <FieldLabel>Type</FieldLabel>
          <SelectInput
            value={variable.type}
            onChange={(v) => {
              const { range: _r, options: _o, ...rest } = variable;
              if (v === "number") {
                onChange({
                  ...rest,
                  type: v,
                  range: variable.range ?? [0, 100],
                });
              } else if (v === "categorical") {
                onChange({
                  ...rest,
                  type: v,
                  options: variable.options ?? ["option_a", "option_b"],
                });
              } else {
                onChange({ ...rest, type: v as Variable["type"] });
              }
            }}
            options={[
              { value: "number", label: "Number" },
              { value: "categorical", label: "Categorical" },
              { value: "boolean", label: "Boolean" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Role</FieldLabel>
          <SelectInput
            value={variable.role}
            onChange={(v) => set({ role: v as Variable["role"] })}
            options={[
              { value: "input", label: "Input" },
              { value: "output", label: "Output" },
              { value: "derived", label: "Derived" },
            ]}
          />
        </div>
        <div className="space-y-1">
          <FieldLabel hint="optional">Unit</FieldLabel>
          <TextInput
            value={variable.unit ?? ""}
            onChange={(v) => set({ unit: v || null })}
            placeholder="e.g. N/m^2"
          />
        </div>
      </div>
      {variable.type === "number" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <FieldLabel>Range Min</FieldLabel>
            <TextInput
              value={String(variable.range?.[0] ?? 0)}
              onChange={(v) =>
                set({ range: [Number(v) || 0, variable.range?.[1] ?? 100] })
              }
              type="number"
            />
          </div>
          <div className="space-y-1">
            <FieldLabel>Range Max</FieldLabel>
            <TextInput
              value={String(variable.range?.[1] ?? 100)}
              onChange={(v) =>
                set({ range: [variable.range?.[0] ?? 0, Number(v) || 100] })
              }
              type="number"
            />
          </div>
        </div>
      )}
      {variable.type === "categorical" && (
        <StringListEditor
          label="Options"
          hint="at least 2"
          items={variable.options ?? []}
          onChange={(v) => set({ options: v })}
          placeholder="e.g. uniform"
        />
      )}
      <div className="space-y-1">
        <FieldLabel hint="optional">Description</FieldLabel>
        <TextInput
          value={variable.description ?? ""}
          onChange={(v) => {
            if (v) {
              set({ description: v });
            } else {
              set({
                description: undefined,
              } as Partial<Variable> & { description?: string | undefined });
            }
          }}
          placeholder="Brief description of what this variable represents"
        />
      </div>
    </div>
  );
}

function RawExpressionInput({
  onAdd,
  existingIds,
}: {
  onAdd: (rule: Rule) => void;
  existingIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [ruleId, setRuleId] = useState("");
  const [description, setDescription] = useState("");
  const [expression, setExpression] = useState("");
  const [validatedBy, setValidatedBy] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const validateExpression = (expr: string) => {
    setExpression(expr);
    if (!expr.trim()) {
      setParseError(null);
      return;
    }
    try {
      const { parseRuleExpression } = require("@/engine/expression-evaluator");
      parseRuleExpression(expr);
      setParseError(null);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Parse error");
    }
  };

  const canAdd =
    ruleId.trim() &&
    !existingIds.has(ruleId.trim()) &&
    description.trim() &&
    expression.trim() &&
    !parseError &&
    validatedBy.trim();

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({
      id: ruleId.trim(),
      description: description.trim(),
      expression: expression.trim(),
      validated_by: validatedBy.trim(),
    });
    setRuleId("");
    setDescription("");
    setExpression("");
    setValidatedBy("");
    setParseError(null);
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-sm text-text-muted hover:text-accent transition"
      >
        Advanced: write a raw expression
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-surface-border bg-surface-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">
          Raw expression
        </span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-text-muted hover:text-text transition"
        >
          Collapse
        </button>
      </div>
      <p className="text-xs text-text-muted">
        Type an expression directly. The parser validates it live.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <FieldLabel hint="snake_case">Rule ID</FieldLabel>
          <TextInput
            value={ruleId}
            onChange={setRuleId}
            placeholder="e.g. pressure_calc"
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Validated By</FieldLabel>
          <TextInput
            value={validatedBy}
            onChange={setValidatedBy}
            placeholder="e.g. NCERT Class 8, Ch 11"
          />
        </div>
      </div>
      <div className="space-y-1">
        <FieldLabel>Description</FieldLabel>
        <TextInput
          value={description}
          onChange={setDescription}
          placeholder="What this rule computes"
        />
      </div>
      <div className="space-y-1">
        <FieldLabel>Expression</FieldLabel>
        <TextInput
          value={expression}
          onChange={validateExpression}
          placeholder="e.g. pressure = force / area"
        />
        {parseError && (
          <p className="text-xs text-red-600 mt-1">{parseError}</p>
        )}
        {expression.trim() && !parseError && (
          <p className="text-xs text-green-600 mt-1">Valid expression</p>
        )}
      </div>
      <button
        type="button"
        disabled={!canAdd}
        onClick={handleAdd}
        className={cn(
          "px-4 py-2 text-sm rounded-md font-medium transition",
          canAdd
            ? "bg-accent text-text-inverse hover:bg-accent-strong"
            : "bg-surface-muted text-text-muted cursor-not-allowed",
        )}
      >
        Add rule
      </button>
    </div>
  );
}

export function StepScience({
  state,
  onChange,
  readOnly = false,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
  readOnly?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  const existingRuleIds = useMemo(
    () => new Set(state.rules.map((r) => r.id)),
    [state.rules],
  );

  /* -- Variables -- */
  const addVariable = () => {
    onChange({
      ...state,
      variables: [
        ...state.variables,
        {
          id: "",
          label: "",
          type: "number",
          unit: null,
          range: [0, 100],
          role: "input",
        },
      ],
    });
  };

  /* -- Rules -- */
  const addRuleFromPattern = (result: FormulaPickerResult) => {
    const rule: Rule = {
      id: `${result.outputVarId}_calc`,
      description: `Computes ${result.outputVarId} using the ${result.patternId} pattern.`,
      expression: result.expression,
      validated_by: "",
    };
    onChange({ ...state, rules: [...state.rules, rule] });
    setShowPicker(false);
  };

  const addRawRule = (rule: Rule) => {
    onChange({ ...state, rules: [...state.rules, rule] });
  };

  const removeRule = (i: number) => {
    onChange({
      ...state,
      rules: state.rules.filter((_, idx) => idx !== i),
    });
  };

  const updateRule = (i: number, patch: Partial<Rule>) => {
    onChange({
      ...state,
      rules: state.rules.map((r, idx) =>
        idx === i ? { ...r, ...patch } : r,
      ),
    });
  };

  /* -- Decision tables -- */
  const addTableFromBuilder = (result: DecisionTableResult) => {
    const table: DecisionTable = {
      id: result.tableId,
      inputs: result.inputs,
      output: result.output,
      rows: result.rows,
      ...(result.defaultValue != null ? { default: result.defaultValue } : {}),
    };
    const rule: Rule = {
      id: `${result.output}_from_table`,
      description: `Classifies ${result.output} using decision table ${result.tableId}.`,
      decision_table_ref: result.tableId,
      validated_by: "",
    };
    onChange({
      ...state,
      decision_tables: [...state.decision_tables, table],
      rules: [...state.rules, rule],
    });
    setShowBuilder(false);
  };

  const removeTable = (i: number) => {
    const table = state.decision_tables[i]!;
    onChange({
      ...state,
      decision_tables: state.decision_tables.filter((_, idx) => idx !== i),
      rules: state.rules.filter((r) => r.decision_table_ref !== table.id),
    });
  };

  if (readOnly) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            The science model comes from the template and is pre-validated.
            You can customise everything else &mdash; prompts, scaffolding,
            assessment &mdash; without worrying about the underlying science.
          </p>
        </div>

        <Section title="Variables" description="Pre-configured from template" defaultOpen={false}>
          {state.variables.length === 0 ? (
            <p className="text-sm text-text-muted">No variables defined.</p>
          ) : (
            <div className="space-y-2">
              {state.variables.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 rounded-md border border-surface-border bg-surface-muted/30 px-3 py-2"
                >
                  <span className="font-mono text-sm text-accent">{v.id}</span>
                  <span className="text-sm text-text">{v.label}</span>
                  <span className="text-xs text-text-soft capitalize">
                    {v.role} &middot; {v.type}
                    {v.unit ? ` (${v.unit})` : ""}
                  </span>
                  {v.type === "number" && v.range && (
                    <span className="text-xs text-text-soft ml-auto">
                      {v.range[0]}&#8211;{v.range[1]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Computation Rules" description="Pre-configured from template" defaultOpen={false}>
          {state.rules.length === 0 ? (
            <p className="text-sm text-text-muted">No rules defined.</p>
          ) : (
            <div className="space-y-2">
              {state.rules.map((r) => (
                <div
                  key={r.id}
                  className="rounded-md border border-surface-border bg-surface-muted/30 px-3 py-2 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-accent">{r.id}</span>
                    <span className="text-xs text-text-muted">{r.description}</span>
                  </div>
                  {r.expression && (
                    <div className="font-mono text-xs text-text-soft bg-surface-muted rounded px-2 py-1">
                      {r.expression}
                    </div>
                  )}
                  {r.decision_table_ref && (
                    <div className="text-xs text-text-soft">
                      Uses table: <span className="font-mono">{r.decision_table_ref}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {state.decision_tables.length > 0 && (
          <Section title="Decision Tables" description="Pre-configured from template" defaultOpen={false}>
            <div className="space-y-2">
              {state.decision_tables.map((t) => (
                <div
                  key={t.id}
                  className="rounded-md border border-surface-border bg-surface-muted/30 px-3 py-2"
                >
                  <span className="font-mono text-sm text-accent">{t.id}</span>
                  <span className="text-xs text-text-muted ml-2">
                    {t.inputs.join(", ")} &rarr; {t.output} ({t.rows.length} rows)
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Variables */}
      <Section
        title="Variables"
        description="The quantities students will manipulate and observe"
      >
        <p className="text-xs text-text-muted">
          Number variables need a range; categorical variables need options;
          boolean variables need neither.
        </p>
        {state.variables.map((v, i) => (
          <VariableEditor
            key={i}
            variable={v}
            onChange={(updated) =>
              onChange({
                ...state,
                variables: state.variables.map((vv, idx) =>
                  idx === i ? updated : vv,
                ),
              })
            }
            onRemove={() =>
              onChange({
                ...state,
                variables: state.variables.filter((_, idx) => idx !== i),
              })
            }
          />
        ))}
        <button
          type="button"
          onClick={addVariable}
          className="w-full py-3 text-sm rounded-md border border-dashed border-surface-border text-text-muted hover:border-accent hover:text-accent transition"
        >
          + Add variable
        </button>
      </Section>

      {/* Rules */}
      <Section
        title="Computation Rules"
        description="How the engine calculates outputs from inputs"
      >
        {state.rules.map((rule, i) => (
          <div
            key={i}
            className="rounded-lg border border-surface-border p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-accent">{rule.id}</span>
              <button
                type="button"
                onClick={() => removeRule(i)}
                className="text-red-500 hover:text-red-700 text-xs transition"
              >
                Remove
              </button>
            </div>
            {rule.expression && (
              <div className="font-mono text-sm bg-surface-muted rounded px-3 py-2">
                {rule.expression}
              </div>
            )}
            {rule.decision_table_ref && (
              <div className="text-sm text-text-muted">
                Decision table:{" "}
                <span className="font-mono">{rule.decision_table_ref}</span>
              </div>
            )}
            <div className="space-y-1">
              <FieldLabel hint="what this rule computes">Description</FieldLabel>
              <TextInput
                value={rule.description}
                onChange={(v) => updateRule(i, { description: v })}
                placeholder="Description"
              />
            </div>
            <div className="space-y-1">
              <FieldLabel hint="citation or SME note">Validated By</FieldLabel>
              <TextInput
                value={rule.validated_by}
                onChange={(v) => updateRule(i, { validated_by: v })}
                placeholder="e.g. NCERT Class 8, Ch 11"
              />
            </div>
          </div>
        ))}

        {showPicker ? (
          <div className="rounded-lg border-2 border-accent/30 p-4">
            <FormulaPatternPicker
              variables={state.variables}
              onComplete={addRuleFromPattern}
              onCancel={() => setShowPicker(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="w-full py-3 text-sm rounded-md border border-dashed border-surface-border text-text-muted hover:border-accent hover:text-accent transition"
          >
            + Add rule via formula picker
          </button>
        )}

        <RawExpressionInput onAdd={addRawRule} existingIds={existingRuleIds} />
      </Section>

      {/* Decision Tables */}
      <Section
        title="Decision Tables"
        description="Map categorical/boolean inputs to outputs"
        defaultOpen={state.decision_tables.length > 0}
      >
        {state.decision_tables.map((table, i) => (
          <div
            key={i}
            className="rounded-lg border border-surface-border p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-accent">{table.id}</span>
              <button
                type="button"
                onClick={() => removeTable(i)}
                className="text-red-500 hover:text-red-700 text-xs transition"
              >
                Remove
              </button>
            </div>
            <div className="text-sm text-text-muted">
              Inputs: {table.inputs.join(", ")} &rarr; Output: {table.output}
            </div>
            <div className="text-sm text-text-muted">
              {table.rows.length} row{table.rows.length !== 1 ? "s" : ""}
              {table.default !== undefined && `, default: ${table.default}`}
            </div>
          </div>
        ))}

        {showBuilder ? (
          <div className="rounded-lg border-2 border-accent/30 p-4">
            <DecisionTableBuilder
              variables={state.variables}
              onComplete={addTableFromBuilder}
              onCancel={() => setShowBuilder(false)}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowBuilder(true)}
            className="w-full py-3 text-sm rounded-md border border-dashed border-surface-border text-text-muted hover:border-accent hover:text-accent transition"
          >
            + Add decision table
          </button>
        )}
      </Section>
    </div>
  );
}

/* ================================================================== */
/*  Step 3: Lab Phases (Provocation → NCL → Investigation →           */
/*          Analysis → Discussion → Reflection)                        */
/* ================================================================== */

function ExperimentEditor({
  experiment,
  variables,
  ruleIds,
  onChange,
  onRemove,
}: {
  experiment: Experiment;
  variables: Variable[];
  ruleIds: string[];
  onChange: (e: Experiment) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<Experiment>) =>
    onChange({ ...experiment, ...patch });
  const varIds = variables.map((v) => v.id);

  const VariableIdList = ({
    label,
    hint,
    items,
    onItemsChange,
  }: {
    label: string;
    hint?: string;
    items: string[];
    onItemsChange: (items: string[]) => void;
  }) => (
    <div className="space-y-1">
      <FieldLabel {...(hint != null ? { hint } : {})}>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {varIds.map((id) => {
          const active = items.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() =>
                onItemsChange(
                  active ? items.filter((x) => x !== id) : [...items, id],
                )
              }
              className={cn(
                "px-2 py-1 text-xs rounded border transition font-mono",
                active
                  ? "bg-accent text-text-inverse border-accent"
                  : "bg-surface text-text-muted border-surface-border hover:border-accent/40",
              )}
            >
              {id}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border border-surface-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-accent">
          {experiment.id || "new_experiment"}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 text-xs transition"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <FieldLabel hint="snake_case">ID</FieldLabel>
          <TextInput
            value={experiment.id}
            onChange={(v) => set({ id: v })}
            placeholder="e.g. pressure_experiment"
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Goal</FieldLabel>
          <TextInput
            value={experiment.goal}
            onChange={(v) => set({ goal: v })}
            placeholder="What this experiment demonstrates"
          />
        </div>
      </div>
      <VariableIdList
        label="Controlled Variables"
        items={experiment.controlled_vars}
        onItemsChange={(v) => set({ controlled_vars: v })}
      />
      <VariableIdList
        label="Manipulated Variables"
        hint="at least 1"
        items={experiment.manipulated_vars}
        onItemsChange={(v) => set({ manipulated_vars: v })}
      />
      <VariableIdList
        label="Measured Variables"
        hint="at least 1"
        items={experiment.measured_vars}
        onItemsChange={(v) => set({ measured_vars: v })}
      />
      <div className="space-y-1">
        <FieldLabel hint="optional">Exercises Rules</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {ruleIds.map((id) => {
            const active = (experiment.exercises_rules ?? []).includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const current = experiment.exercises_rules ?? [];
                  set({
                    exercises_rules: active
                      ? current.filter((x) => x !== id)
                      : [...current, id],
                  });
                }}
                className={cn(
                  "px-2 py-1 text-xs rounded border transition font-mono",
                  active
                    ? "bg-accent text-text-inverse border-accent"
                    : "bg-surface text-text-muted border-surface-border hover:border-accent/40",
                )}
              >
                {id}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StepPhases({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
}) {
  const p = state.provocation;
  const n = state.ncl;
  const inv = state.investigation;
  const a = state.analysis;
  const d = state.discussion;
  const r = state.reflection;

  const setP = (patch: Partial<typeof p>) =>
    onChange({ ...state, provocation: { ...p, ...patch } });
  const setN = (patch: Partial<typeof n>) =>
    onChange({ ...state, ncl: { ...n, ...patch } });
  const setInv = (patch: Partial<typeof inv>) =>
    onChange({ ...state, investigation: { ...inv, ...patch } });
  const setA = (patch: Partial<typeof a>) =>
    onChange({ ...state, analysis: { ...a, ...patch } });
  const setD = (patch: Partial<typeof d>) =>
    onChange({ ...state, discussion: { ...d, ...patch } });
  const setR = (patch: Partial<typeof r>) =>
    onChange({ ...state, reflection: { ...r, ...patch } });

  const varIds = state.variables.map((v) => v.id);
  const ruleIds = state.rules.map((ru) => ru.id);

  const updateKeyTerm = (i: number, patch: Partial<KeyTerm>) =>
    setN({
      key_terms: n.key_terms.map((kt, idx) =>
        idx === i ? { ...kt, ...patch } : kt,
      ),
    });

  const addExperiment = () => {
    setInv({
      experiments: [
        ...inv.experiments,
        {
          id: "",
          goal: "",
          controlled_vars: [],
          manipulated_vars: [],
          measured_vars: [],
        },
      ],
    });
  };

  return (
    <div className="space-y-6">
      {/* Provocation */}
      <Section
        title="1. Provocation"
        description="The hook that sparks curiosity"
      >
        <div className="space-y-1">
          <FieldLabel>Real-life Scenario</FieldLabel>
          <TextArea
            value={p.real_life_scenario}
            onChange={(v) => setP({ real_life_scenario: v })}
            placeholder="A relatable scenario that motivates the topic..."
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Curiosity Hook</FieldLabel>
          <TextArea
            value={p.curiosity_hook}
            onChange={(v) => setP({ curiosity_hook: v })}
            placeholder="An intriguing observation or question..."
            rows={2}
          />
        </div>
        <div className="space-y-1">
          <FieldLabel>Motivating Question</FieldLabel>
          <TextArea
            value={p.motivating_question}
            onChange={(v) => setP({ motivating_question: v })}
            placeholder="The driving question for the investigation..."
            rows={2}
          />
        </div>
        <ScaffoldingLevelPicker
          value={p.scaffolding_level}
          onChange={(v) => setP({ scaffolding_level: v })}
        />
      </Section>

      {/* NCL */}
      <Section
        title="2. Need to Know Concepts"
        description="Concepts and vocabulary students need before they investigate"
      >
        <StringListEditor
          label="Concepts Required"
          hint="at least 1"
          items={n.concepts_required}
          onChange={(v) => setN({ concepts_required: v })}
          placeholder="e.g. Pressure: the effect of force on an area."
        />
        <div className="space-y-2">
          <FieldLabel hint="at least 1">Key Terms</FieldLabel>
          {n.key_terms.map((kt, i) => (
            <div key={i} className="flex gap-2">
              <TextInput
                value={kt.term}
                onChange={(v) => updateKeyTerm(i, { term: v })}
                placeholder="Term"
              />
              <TextInput
                value={kt.definition}
                onChange={(v) => updateKeyTerm(i, { definition: v })}
                placeholder="Definition"
              />
              {n.key_terms.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setN({
                      key_terms: n.key_terms.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-red-500 hover:text-red-700 text-xs px-2 transition shrink-0"
                >
                  &#10005;
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setN({
                key_terms: [...n.key_terms, { term: "", definition: "" }],
              })
            }
            className="text-sm text-accent hover:text-accent-strong transition"
          >
            + Add term
          </button>
        </div>
        <ScaffoldingLevelPicker
          value={n.scaffolding_level}
          onChange={(v) => setN({ scaffolding_level: v })}
        />
      </Section>

      {/* Investigation */}
      <Section
        title="3. Investigation"
        description="The hands-on experiment phase"
      >
        <div className="space-y-1">
          <FieldLabel>Orientation Prompt</FieldLabel>
          <TextArea
            value={inv.orientation_prompt}
            onChange={(v) => setInv({ orientation_prompt: v })}
            placeholder="Describe the setup the student will work with..."
          />
        </div>
        <StringListEditor
          label="Questioning Prompts"
          hint="at least 1"
          items={inv.questioning_prompts}
          onChange={(v) => setInv({ questioning_prompts: v })}
          placeholder="If you increase force, what happens to pressure?"
        />
        <StringListEditor
          label="Hypothesis Scaffolds"
          hint="at least 1"
          items={inv.hypothesis_scaffolds}
          onChange={(v) => setInv({ hypothesis_scaffolds: v })}
          placeholder="I predict that when ___, then ___."
        />
        <div className="space-y-1">
          <FieldLabel hint="at least 1">Explorable Variables</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {varIds.map((id) => {
              const active = inv.explorable_variables.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setInv({
                      explorable_variables: active
                        ? inv.explorable_variables.filter((x) => x !== id)
                        : [...inv.explorable_variables, id],
                    })
                  }
                  className={cn(
                    "px-2 py-1 text-xs rounded border transition font-mono",
                    active
                      ? "bg-accent text-text-inverse border-accent"
                      : "bg-surface text-text-muted border-surface-border hover:border-accent/40",
                  )}
                >
                  {id}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <FieldLabel hint="at least 1">Experiments</FieldLabel>
          {inv.experiments.map((exp, i) => (
            <ExperimentEditor
              key={i}
              experiment={exp}
              variables={state.variables}
              ruleIds={ruleIds}
              onChange={(updated) =>
                setInv({
                  experiments: inv.experiments.map((e, idx) =>
                    idx === i ? updated : e,
                  ),
                })
              }
              onRemove={() =>
                setInv({
                  experiments: inv.experiments.filter((_, idx) => idx !== i),
                })
              }
            />
          ))}
          <button
            type="button"
            onClick={addExperiment}
            className="w-full py-2 text-sm rounded-md border border-dashed border-surface-border text-text-muted hover:border-accent hover:text-accent transition"
          >
            + Add experiment
          </button>
        </div>
        <StringListEditor
          label="Data Interpretation Prompts"
          hint="at least 1"
          items={inv.data_interpretation_prompts}
          onChange={(v) => setInv({ data_interpretation_prompts: v })}
          placeholder="What pattern do you see when..."
        />
        <ScaffoldingLevelPicker
          value={inv.scaffolding_level}
          onChange={(v) => setInv({ scaffolding_level: v })}
        />
      </Section>

      {/* Analysis */}
      <Section
        title="4. Analysis"
        description="Guiding students to interpret their results"
      >
        <StringListEditor
          label="Guiding Questions"
          hint="at least 1"
          items={a.guiding_questions}
          onChange={(v) => setA({ guiding_questions: v })}
          placeholder="Explain in your own words why..."
        />
        <StringListEditor
          label="Expected Patterns"
          hint="at least 1"
          items={a.expected_patterns}
          onChange={(v) => setA({ expected_patterns: v })}
          placeholder="Students should observe that..."
        />
        <ScaffoldingLevelPicker
          value={a.scaffolding_level}
          onChange={(v) => setA({ scaffolding_level: v })}
        />
      </Section>

      {/* Discussion */}
      <Section
        title="5. Discussion"
        description="Peer interaction and sharing findings"
      >
        <StringListEditor
          label="Discussion Prompts"
          hint="at least 1"
          items={d.discussion_prompts}
          onChange={(v) => setD({ discussion_prompts: v })}
          placeholder="Share one finding that surprised you..."
        />
        <div className="space-y-1">
          <FieldLabel>Peer Interaction Type</FieldLabel>
          <TextInput
            value={d.peer_interaction_type}
            onChange={(v) => setD({ peer_interaction_type: v })}
            placeholder="e.g. pair-and-share, group discussion"
          />
        </div>
        <ScaffoldingLevelPicker
          value={d.scaffolding_level}
          onChange={(v) => setD({ scaffolding_level: v })}
        />
      </Section>

      {/* Reflection */}
      <Section
        title="6. Reflection"
        description="Helping students think about their learning"
      >
        <StringListEditor
          label="Reflection Prompts"
          hint="at least 1"
          items={r.reflection_prompts}
          onChange={(v) => setR({ reflection_prompts: v })}
          placeholder="What is one thing you understand now that you didn't before?"
        />
        <StringListEditor
          label="Metacognitive Prompts"
          hint="at least 1"
          items={r.metacognitive_prompts}
          onChange={(v) => setR({ metacognitive_prompts: v })}
          placeholder="When did you realise your prediction was wrong?"
        />
        <ScaffoldingLevelPicker
          value={r.scaffolding_level}
          onChange={(v) => setR({ scaffolding_level: v })}
        />
      </Section>
    </div>
  );
}

/* ================================================================== */
/*  Step 4: AI Tutor & Assessment                                      */
/* ================================================================== */

export function StepTutor({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (s: WizardState) => void;
}) {
  const assess = state.assessment;
  const tutor = state.ai_tutor_config;

  const setAssess = (patch: Partial<typeof assess>) =>
    onChange({ ...state, assessment: { ...assess, ...patch } });
  const setTutor = (patch: Partial<typeof tutor>) =>
    onChange({ ...state, ai_tutor_config: { ...tutor, ...patch } });

  const updateCriterion = (i: number, patch: Partial<RubricCriterion>) =>
    setAssess({
      rubric: assess.rubric.map((c, idx) =>
        idx === i ? { ...c, ...patch } : c,
      ),
    });

  const allAllowed: AllowedAction[] = [
    "hint",
    "rephrase_question",
    "encourage",
    "socratic_prompt",
    "summarize_student_reasoning",
  ];
  const allForbidden: ForbiddenAction[] = [
    "compute_science",
    "state_scientific_fact",
    "give_final_answer",
  ];

  return (
    <div className="space-y-6">
      <Section
        title="AI Tutor Configuration"
        description="What the AI tutor is allowed and forbidden to do"
      >
        <div className="space-y-1">
          <FieldLabel>Allowed Actions</FieldLabel>
          <p className="text-xs text-text-muted mb-2">
            Select what the tutor may do to help students.
          </p>
          <div className="flex flex-wrap gap-2">
            {allAllowed.map((action) => {
              const active = tutor.allowed_actions.includes(action);
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() =>
                    setTutor({
                      allowed_actions: active
                        ? tutor.allowed_actions.filter((a) => a !== action)
                        : [...tutor.allowed_actions, action],
                    })
                  }
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-md border transition",
                    active
                      ? "bg-green-100 text-green-800 border-green-300"
                      : "bg-surface text-text-muted border-surface-border hover:border-green-300",
                  )}
                >
                  {action.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <FieldLabel>Forbidden Actions</FieldLabel>
          <p className="text-xs text-text-muted mb-2">
            The tutor will never do these, even if a student asks.
          </p>
          <div className="flex flex-wrap gap-2">
            {allForbidden.map((action) => {
              const active = tutor.forbidden_actions.includes(action);
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() =>
                    setTutor({
                      forbidden_actions: active
                        ? tutor.forbidden_actions.filter((a) => a !== action)
                        : [...tutor.forbidden_actions, action],
                    })
                  }
                  className={cn(
                    "px-3 py-1.5 text-xs rounded-md border transition",
                    active
                      ? "bg-red-100 text-red-800 border-red-300"
                      : "bg-surface text-text-muted border-surface-border hover:border-red-300",
                  )}
                >
                  {action.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <FieldLabel>Fallback When Asked Science</FieldLabel>
          <TextArea
            value={tutor.fallback_when_asked_science}
            onChange={(v) => setTutor({ fallback_when_asked_science: v })}
            placeholder="I'm not the source of the science -- the engine is. Try the calculation..."
          />
        </div>
      </Section>

      <Section
        title="Assessment Rubric"
        description="How to evaluate student performance"
      >
        {assess.rubric.map((c, i) => (
          <div
            key={i}
            className="rounded-lg border border-surface-border p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <FieldLabel>Criterion {i + 1}</FieldLabel>
              {assess.rubric.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setAssess({
                      rubric: assess.rubric.filter((_, idx) => idx !== i),
                    })
                  }
                  className="text-red-500 hover:text-red-700 text-xs transition"
                >
                  Remove
                </button>
              )}
            </div>
            <TextInput
              value={c.criterion}
              onChange={(v) => updateCriterion(i, { criterion: v })}
              placeholder="e.g. Applies pressure = force / area correctly"
            />
            <StringListEditor
              label="Levels"
              hint="at least 2, lowest to highest"
              items={c.levels}
              onChange={(v) => updateCriterion(i, { levels: v })}
              placeholder="Performance level description"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setAssess({
              rubric: [
                ...assess.rubric,
                { criterion: "", levels: ["", "", ""] },
              ],
            })
          }
          className="text-sm text-accent hover:text-accent-strong transition"
        >
          + Add criterion
        </button>
      </Section>

      <Section
        title="Formative Checks"
        description="Quick checks during the lab"
      >
        <StringListEditor
          label="Formative Checks"
          hint="at least 1"
          items={assess.formative_checks}
          onChange={(v) => setAssess({ formative_checks: v })}
          placeholder="Predict the value BEFORE running the engine"
        />
      </Section>
    </div>
  );
}
