"use client";

/**
 * Checkpoint 2 demo page — shows the Formula Pattern Picker and
 * Decision Table Builder constructing the Class 8 Pressure lab's rules:
 *
 *   1. pressure = force / area            (Division pattern)
 *   2. high_pressure = pressure > 50      (Threshold pattern → derived boolean)
 *   3. effect_table: high_pressure → dents / punctures / no_effect
 *      (Decision table with boolean input → categorical output)
 *
 * This demonstrates the bridge pattern: expression rule → derived boolean →
 * decision table → categorical output. The same pattern proven in the
 * Class 9 motion spec.
 */

import { useState } from "react";
import {
  FormulaPatternPicker,
  type FormulaPickerResult,
} from "@/components/author/formula-pattern-picker";
import {
  DecisionTableBuilder,
  type DecisionTableResult,
} from "@/components/author/decision-table-builder";
import type { Variable } from "@/schema/lab-spec";

/* ------------------------------------------------------------------ */
/*  Demo variables — what a teacher would have declared for Pressure   */
/* ------------------------------------------------------------------ */

const PRESSURE_VARIABLES: Variable[] = [
  {
    id: "force",
    label: "Applied Force",
    type: "number",
    unit: "N",
    range: [0, 500],
    role: "input",
  },
  {
    id: "area",
    label: "Contact Area",
    type: "number",
    unit: "cm²",
    range: [1, 100],
    role: "input",
  },
  {
    id: "pressure",
    label: "Pressure",
    type: "number",
    unit: "N/cm²",
    range: [0, 500],
    role: "output",
  },
  {
    id: "high_pressure",
    label: "High Pressure?",
    type: "boolean",
    unit: null,
    role: "derived",
  },
  {
    id: "surface_type",
    label: "Surface Type",
    type: "categorical",
    unit: null,
    options: ["soft_clay", "hard_wood", "metal_sheet"],
    role: "input",
  },
  {
    id: "effect",
    label: "Observed Effect",
    type: "categorical",
    unit: null,
    options: ["dents", "punctures", "no_effect"],
    role: "output",
  },
];

/* ------------------------------------------------------------------ */
/*  Demo modes                                                         */
/* ------------------------------------------------------------------ */

type DemoMode = "formula" | "decision_table" | "results";

/* ------------------------------------------------------------------ */
/*  Results panel                                                      */
/* ------------------------------------------------------------------ */

function ResultPanel({
  label,
  result,
}: {
  label: string;
  result: FormulaPickerResult | DecisionTableResult;
}) {
  return (
    <div className="rounded-lg border border-green-300 bg-green-50 p-4">
      <div className="text-sm font-semibold text-green-800 mb-2">{label}</div>
      <pre className="text-xs text-green-900 whitespace-pre-wrap overflow-x-auto">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AuthorDemoPage() {
  const [mode, setMode] = useState<DemoMode>("formula");
  const [formulaResults, setFormulaResults] = useState<FormulaPickerResult[]>([]);
  const [tableResult, setTableResult] = useState<DecisionTableResult | null>(null);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-text mb-1">
        Authoring Wizard — CP2 Demo
      </h1>
      <p className="text-sm text-text-muted mb-8">
        Demonstrates the Formula Pattern Picker and Decision Table Builder
        constructing the Class 8 Pressure lab&apos;s rules.
      </p>

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        {(
          [
            ["formula", "Formula Pattern Picker"],
            ["decision_table", "Decision Table Builder"],
            ["results", `Results (${formulaResults.length + (tableResult ? 1 : 0)})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id as DemoMode)}
            className={`px-4 py-2 text-sm rounded-md border transition ${
              mode === id
                ? "bg-accent text-text-inverse border-accent"
                : "bg-surface text-text border-surface-border hover:border-accent/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Demo hint */}
      {mode === "formula" && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
          <strong>Try this:</strong> Select &ldquo;Division&rdquo; and map
          OUT→pressure, A→force, B→area. Then switch back and select
          &ldquo;Threshold&rdquo; to create high_pressure = pressure &gt; 50.
        </div>
      )}
      {mode === "decision_table" && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-6">
          <strong>Try this:</strong> Select high_pressure + surface_type as
          inputs, effect as output, and build rows like: (true, soft_clay) → dents,
          (true, metal_sheet) → no_effect, etc.
        </div>
      )}

      {/* Active builder */}
      {mode === "formula" && (
        <FormulaPatternPicker
          variables={PRESSURE_VARIABLES}
          onComplete={(result) => {
            setFormulaResults((prev) => [...prev, result]);
            setMode("results");
          }}
          onCancel={() => {}}
        />
      )}
      {mode === "decision_table" && (
        <DecisionTableBuilder
          variables={PRESSURE_VARIABLES}
          onComplete={(result) => {
            setTableResult(result);
            setMode("results");
          }}
          onCancel={() => {}}
        />
      )}
      {mode === "results" && (
        <div className="space-y-4">
          {formulaResults.length === 0 && !tableResult && (
            <p className="text-sm text-text-muted">
              No rules created yet. Use the Formula Pattern Picker or Decision
              Table Builder to add rules.
            </p>
          )}
          {formulaResults.map((r, i) => (
            <ResultPanel
              key={i}
              label={`Expression Rule ${i + 1}: ${r.expression}`}
              result={r}
            />
          ))}
          {tableResult && (
            <ResultPanel
              label={`Decision Table: ${tableResult.tableId}`}
              result={tableResult}
            />
          )}
          {(formulaResults.length > 0 || tableResult) && (
            <button
              type="button"
              onClick={() => {
                setFormulaResults([]);
                setTableResult(null);
              }}
              className="px-3 py-1.5 text-sm rounded-md border border-surface-border text-text-muted hover:text-red-600 hover:border-red-300 transition"
            >
              Clear all results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
