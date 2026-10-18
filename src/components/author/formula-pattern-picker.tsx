"use client";

/**
 * FormulaPatternPicker — lets a teacher choose a formula pattern
 * from the library, map variables to slots, and preview the resulting
 * expression string.
 *
 * Used inside the authoring wizard's rule-creation step. The component
 * is fully client-side — it reads from the pattern library (pure data)
 * and emits the completed expression + metadata to the parent.
 */

import { useState, useMemo } from "react";
import {
  FORMULA_PATTERNS,
  instantiatePattern,
  type FormulaPattern,
  type PatternSlot,
} from "@/app/lib/formula-patterns";
import type { Variable } from "@/schema/lab-spec";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */
/*  Public interface                                                    */
/* ------------------------------------------------------------------ */

export interface FormulaPickerResult {
  /** The pattern id chosen. */
  patternId: string;
  /** Engine-ready expression string, e.g. "pressure = force / area". */
  expression: string;
  /** The output variable id. */
  outputVarId: string;
  /** True if the pattern produces a boolean output. */
  outputIsBoolean: boolean;
  /** The threshold value, if the pattern uses one. */
  thresholdValue?: number | undefined;
}

interface Props {
  /** All variables declared so far in the science model. */
  variables: Variable[];
  /** Called when the teacher completes a valid pattern configuration. */
  onComplete: (result: FormulaPickerResult) => void;
  /** Called when the teacher cancels / goes back. */
  onCancel: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Filter variables that can fill a given slot. */
function candidatesForSlot(
  slot: PatternSlot,
  variables: Variable[],
): Variable[] {
  return variables.filter((v) => {
    if (slot.variableType === "any") return true;
    return v.type === slot.variableType;
  });
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function PatternCard({
  pattern,
  selected,
  onClick,
}: {
  pattern: FormulaPattern;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-4 transition",
        selected
          ? "border-accent bg-accent/5 ring-2 ring-accent"
          : "border-surface-border bg-surface hover:border-accent/40 hover:shadow-sm",
      )}
    >
      <div className="font-medium text-sm text-text">{pattern.label}</div>
      <div className="mt-1 text-xs text-text-muted leading-relaxed">
        {pattern.description}
      </div>
      <div className="mt-2 font-mono text-xs text-accent">
        {pattern.template}
      </div>
    </button>
  );
}

function SlotSelector({
  slot,
  variables,
  value,
  onChange,
  usedVarIds,
}: {
  slot: PatternSlot;
  variables: Variable[];
  value: string;
  onChange: (varId: string) => void;
  /** Variable ids already assigned to other slots — shown greyed. */
  usedVarIds: Set<string>;
}) {
  const candidates = candidatesForSlot(slot, variables);

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text">
        {slot.label}
        <span className="ml-1 text-xs text-text-soft">
          ({slot.variableType})
        </span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <option value="">— select variable —</option>
        {candidates.map((v) => (
          <option
            key={v.id}
            value={v.id}
            disabled={usedVarIds.has(v.id)}
          >
            {v.label} ({v.id})
            {v.unit ? ` [${v.unit}]` : ""}
            {usedVarIds.has(v.id) ? " (already used)" : ""}
          </option>
        ))}
      </select>
      {candidates.length === 0 && (
        <p className="text-xs text-red-600">
          No {slot.variableType} variables declared yet.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function FormulaPatternPicker({ variables, onComplete, onCancel }: Props) {
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [slotMapping, setSlotMapping] = useState<Record<string, string>>({});
  const [thresholdValue, setThresholdValue] = useState<string>("");

  const selectedPattern = useMemo(
    () => FORMULA_PATTERNS.find((p) => p.id === selectedPatternId) ?? null,
    [selectedPatternId],
  );

  /* When switching patterns, reset slot mapping and threshold. */
  const selectPattern = (id: string) => {
    setSelectedPatternId(id);
    setSlotMapping({});
    setThresholdValue("");
  };

  /* Track which variable ids are already used across slots. */
  const usedVarIds = useMemo(() => {
    const set = new Set<string>();
    for (const v of Object.values(slotMapping)) {
      if (v) set.add(v);
    }
    return set;
  }, [slotMapping]);

  /* Compute live preview expression. */
  const preview = useMemo(() => {
    if (!selectedPattern) return null;
    // Check all slots filled
    for (const slot of selectedPattern.slots) {
      if (!slotMapping[slot.id]) return null;
    }
    // Check threshold if needed
    const needsThreshold = selectedPattern.template.includes("THRESHOLD");
    const tv = needsThreshold ? Number(thresholdValue) : undefined;
    if (needsThreshold && (thresholdValue === "" || !Number.isFinite(tv))) {
      return null;
    }
    try {
      return instantiatePattern(selectedPattern, slotMapping, tv);
    } catch {
      return null;
    }
  }, [selectedPattern, slotMapping, thresholdValue]);

  const canSubmit = preview !== null;

  const handleSubmit = () => {
    if (!selectedPattern || !preview) return;
    const outputSlot = selectedPattern.slots.find((s) => s.isOutput);
    if (!outputSlot) return;
    const outputVarId = slotMapping[outputSlot.id];
    if (!outputVarId) return;
    onComplete({
      patternId: selectedPattern.id,
      expression: preview,
      outputVarId,
      outputIsBoolean: selectedPattern.outputIsBoolean ?? false,
      thresholdValue: selectedPattern.template.includes("THRESHOLD")
        ? Number(thresholdValue)
        : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Choose a pattern */}
      <div>
        <h3 className="text-sm font-semibold text-text mb-3">
          Step 1 — Choose a formula pattern
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {FORMULA_PATTERNS.map((p) => (
            <PatternCard
              key={p.id}
              pattern={p}
              selected={selectedPatternId === p.id}
              onClick={() => selectPattern(p.id)}
            />
          ))}
        </div>
      </div>

      {/* Step 2: Map variables to slots */}
      {selectedPattern && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-3">
            Step 2 — Assign variables to each slot
          </h3>
          <div className="space-y-4">
            {selectedPattern.slots.map((slot) => (
              <SlotSelector
                key={slot.id}
                slot={slot}
                variables={variables}
                value={slotMapping[slot.id] ?? ""}
                onChange={(varId) =>
                  setSlotMapping((prev) => ({ ...prev, [slot.id]: varId }))
                }
                usedVarIds={usedVarIds}
              />
            ))}

            {/* Threshold value input (only for threshold patterns) */}
            {selectedPattern.template.includes("THRESHOLD") && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-text">
                  Threshold value
                  <span className="ml-1 text-xs text-text-soft">(number)</span>
                </label>
                <input
                  type="number"
                  value={thresholdValue}
                  onChange={(e) => setThresholdValue(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live preview */}
      {selectedPattern && (
        <div>
          <h3 className="text-sm font-semibold text-text mb-2">
            Preview
          </h3>
          <div
            className={cn(
              "rounded-md border px-4 py-3 font-mono text-sm",
              preview
                ? "border-green-300 bg-green-50 text-green-800"
                : "border-surface-border bg-surface-muted text-text-muted",
            )}
          >
            {preview ?? "Fill in all slots to preview the expression…"}
          </div>
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
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={cn(
            "px-4 py-2 text-sm rounded-md font-medium transition",
            canSubmit
              ? "bg-accent text-text-inverse hover:bg-accent-strong"
              : "bg-surface-muted text-text-muted cursor-not-allowed",
          )}
        >
          Use this expression
        </button>
      </div>
    </div>
  );
}
