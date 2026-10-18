"use client";

/**
 * DecisionTableBuilder — lets a teacher construct a decision table
 * by selecting input variables (categorical/boolean only), an output
 * variable, and filling rows via dropdown selectors.
 *
 * CRITICAL CONSTRAINTS (from user's Prompt 5 CP2 requirements):
 *   1. Input variables are restricted to categorical/boolean — no
 *      number type in the input dropdown. If a teacher needs a numeric
 *      threshold to drive a categorical outcome, they first create a
 *      derived boolean via the Formula Pattern Picker.
 *   2. Cell values are dropdown-only, sourced from the variable's own
 *      declared options (categorical) or true/false (boolean). Never
 *      a free-text field. This prevents typos in category values.
 */

import { useState, useMemo } from "react";
import type { Variable, DecisionTableRow } from "@/schema/lab-spec";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/*  Public interface                                                    */
/* ------------------------------------------------------------------ */

export interface DecisionTableResult {
  /** The table id (teacher provides). */
  tableId: string;
  /** Variable ids used as inputs. */
  inputs: string[];
  /** Output variable id. */
  output: string;
  /** The rows: when → then. */
  rows: DecisionTableRow[];
  /** Optional default value when no row matches. */
  defaultValue?: string | boolean | undefined;
}

interface Props {
  /** All variables declared so far in the science model. */
  variables: Variable[];
  /** Called when the teacher completes a valid table. */
  onComplete: (result: DecisionTableResult) => void;
  /** Called when the teacher cancels. */
  onCancel: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Only categorical and boolean variables can be decision table inputs. */
function eligibleInputs(variables: Variable[]): Variable[] {
  return variables.filter(
    (v) => v.type === "categorical" || v.type === "boolean",
  );
}

/** Variables eligible as the output — categorical or boolean. */
function eligibleOutputs(variables: Variable[]): Variable[] {
  return variables.filter(
    (v) => v.type === "categorical" || v.type === "boolean",
  );
}

/** Get the selectable options for a variable. */
function optionsForVariable(v: Variable): string[] {
  if (v.type === "boolean") return ["true", "false"];
  return v.options ?? [];
}

/** Convert a dropdown string value to a typed value for a DecisionTableRow. */
function toRowValue(raw: string, variable: Variable): string | boolean {
  if (variable.type === "boolean") return raw === "true";
  return raw;
}

/** Convert a row value back to a string for the dropdown. */
function fromRowValue(val: string | number | boolean): string {
  return String(val);
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function VariableMultiSelect({
  label,
  candidates,
  selected,
  onChange,
}: {
  label: string;
  candidates: Variable[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-text">{label}</div>
      {candidates.length === 0 ? (
        <p className="text-xs text-red-600">
          No categorical or boolean variables declared yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {candidates.map((v) => {
            const active = selected.includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggle(v.id)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md border transition",
                  active
                    ? "bg-accent text-text-inverse border-accent"
                    : "bg-surface text-text border-surface-border hover:border-accent/40",
                )}
              >
                {v.label}
                <span className="ml-1 text-xs opacity-70">
                  ({v.type})
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CellDropdown({
  variable,
  value,
  onChange,
}: {
  variable: Variable;
  value: string;
  onChange: (v: string) => void;
}) {
  const opts = optionsForVariable(variable);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-surface-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <option value="">—</option>
      {opts.map((opt) => (
        <option key={opt} value={opt}>
          {opt.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/*  Row editor                                                         */
/* ------------------------------------------------------------------ */

interface RowState {
  /** keyed by input variable id → selected option string */
  when: Record<string, string>;
  /** output value string */
  then: string;
}

function emptyRow(inputIds: string[]): RowState {
  const when: Record<string, string> = {};
  for (const id of inputIds) when[id] = "";
  return { when, then: "" };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function DecisionTableBuilder({ variables, onComplete, onCancel }: Props) {
  const [tableId, setTableId] = useState("");
  const [selectedInputIds, setSelectedInputIds] = useState<string[]>([]);
  const [outputId, setOutputId] = useState("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [defaultVal, setDefaultVal] = useState("");

  const inputCandidates = useMemo(() => eligibleInputs(variables), [variables]);
  const outputCandidates = useMemo(() => eligibleOutputs(variables), [variables]);

  const inputVars = useMemo(
    () => selectedInputIds.map((id) => variables.find((v) => v.id === id)!).filter(Boolean),
    [selectedInputIds, variables],
  );
  const outputVar = useMemo(
    () => variables.find((v) => v.id === outputId),
    [outputId, variables],
  );

  /* When input selection changes, rebuild rows with correct columns. */
  const handleInputChange = (ids: string[]) => {
    setSelectedInputIds(ids);
    setRows([emptyRow(ids)]);
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(selectedInputIds)]);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRowWhen = (rowIdx: number, varId: string, value: string) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === rowIdx ? { ...r, when: { ...r.when, [varId]: value } } : r,
      ),
    );
  };

  const updateRowThen = (rowIdx: number, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, then: value } : r)),
    );
  };

  /* Validation: all rows must have all cells filled, table id non-empty. */
  const isValid = useMemo(() => {
    if (!tableId.trim()) return false;
    if (selectedInputIds.length === 0) return false;
    if (!outputId) return false;
    if (rows.length === 0) return false;
    for (const row of rows) {
      for (const id of selectedInputIds) {
        if (!row.when[id]) return false;
      }
      if (!row.then) return false;
    }
    return true;
  }, [tableId, selectedInputIds, outputId, rows]);

  const handleSubmit = () => {
    if (!isValid || !outputVar) return;

    const typedRows: DecisionTableRow[] = rows.map((r) => {
      const when: Record<string, string | boolean> = {};
      for (const [varId, val] of Object.entries(r.when)) {
        const v = variables.find((vv) => vv.id === varId)!;
        when[varId] = toRowValue(val, v);
      }
      return {
        when,
        then: toRowValue(r.then, outputVar),
      };
    });

    onComplete({
      tableId: tableId.trim(),
      inputs: selectedInputIds,
      output: outputId,
      rows: typedRows,
      defaultValue: defaultVal ? toRowValue(defaultVal, outputVar) : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Table ID */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-text">
          Table ID
          <span className="ml-1 text-xs text-text-soft">(snake_case)</span>
        </label>
        <input
          type="text"
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
          placeholder="e.g. effect_table"
          className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      {/* Input variable selection */}
      <VariableMultiSelect
        label="Input variables (categorical / boolean only)"
        candidates={inputCandidates}
        selected={selectedInputIds}
        onChange={handleInputChange}
      />

      {/* Output variable selection */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-text">
          Output variable
        </label>
        <select
          value={outputId}
          onChange={(e) => setOutputId(e.target.value)}
          className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="">— select output —</option>
          {outputCandidates.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} ({v.id})
              {v.options ? ` [${v.options.join(", ")}]` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Row builder */}
      {selectedInputIds.length > 0 && outputVar && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">
            Decision rows
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {inputVars.map((v) => (
                    <th
                      key={v.id}
                      className="text-left px-2 py-2 border-b border-surface-border text-text-muted font-medium"
                    >
                      {v.label}
                    </th>
                  ))}
                  <th className="text-left px-2 py-2 border-b border-surface-border text-text-muted font-medium">
                    → {outputVar.label}
                  </th>
                  <th className="w-10 border-b border-surface-border" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-surface-border/50">
                    {inputVars.map((v) => (
                      <td key={v.id} className="px-2 py-2">
                        <CellDropdown
                          variable={v}
                          value={row.when[v.id] ?? ""}
                          onChange={(val) => updateRowWhen(rowIdx, v.id, val)}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <CellDropdown
                        variable={outputVar}
                        value={row.then}
                        onChange={(val) => updateRowThen(rowIdx, val)}
                      />
                    </td>
                    <td className="px-2 py-2">
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(rowIdx)}
                          className="text-red-500 hover:text-red-700 text-xs transition"
                          aria-label="Remove row"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-2 px-3 py-1.5 text-sm rounded-md border border-dashed border-surface-border text-text-muted hover:border-accent hover:text-accent transition"
          >
            + Add row
          </button>
        </div>
      )}

      {/* Default value */}
      {outputVar && (
        <div className="space-y-1">
          <label className="block text-sm font-medium text-text">
            Default value
            <span className="ml-1 text-xs text-text-soft">(when no row matches — optional)</span>
          </label>
          <CellDropdown
            variable={outputVar}
            value={defaultVal}
            onChange={setDefaultVal}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-md border border-surface-border bg-surface text-text hover:bg-surface-muted transition"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!isValid}
          onClick={handleSubmit}
          className={cn(
            "px-4 py-2 text-sm rounded-md font-medium transition",
            isValid
              ? "bg-accent text-text-inverse hover:bg-accent-strong"
              : "bg-surface-muted text-text-muted cursor-not-allowed",
          )}
        >
          Use this decision table
        </button>
      </div>
    </div>
  );
}
