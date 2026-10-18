"use client";

/**
 * Renders the appropriate control for a declared variable.
 *
 * Number  → slider + linked number input. Clamps to range on blur, NOT on
 *           each keystroke, so a student can type "10" through the "1" ->
 *           "10" transition even when the min is 5.
 * Categorical → <select>. Options come from the spec.
 * Boolean → two-button pill toggle.
 *
 * Slider step heuristic (approved Prompt 3 Checkpoint 1):
 *   step = 1 if range span ≤ 20; else step = max(1, round(span / 100)).
 * Applied only to the slider; the number input always accepts any real
 * value within range on blur.
 */

import { useEffect, useState } from "react";
import type { Variable } from "@/schema/lab-spec";
import type { Scalar } from "@/engine/types";
import { cn } from "@/lib/cn";

interface Props {
  variable: Variable;
  value: Scalar | undefined;
  onChange: (v: Scalar) => void;
  /**
   * Called once the value has settled: slider released (pointer, touch or
   * a keyboard step), number field blurred with a changed value, select
   * changed, or toggle clicked. Optional — labs without a live stage
   * ignore it and keep the explicit Run button.
   */
  onCommit?: ((v: Scalar) => void) | undefined;
  disabled?: boolean;
}

/** Reasonable default when a variable has no value yet. */
export function defaultValue(v: Variable): Scalar {
  if (v.type === "number") return v.range ? v.range[0] : 0;
  if (v.type === "categorical") return v.options?.[0] ?? "";
  if (v.type === "boolean") return false;
  return 0;
}

function sliderStep(min: number, max: number): number {
  const span = max - min;
  if (span <= 20) return 1;
  return Math.max(1, Math.round(span / 100));
}

function NumberControl({
  variable,
  value,
  onChange,
  onCommit,
  disabled,
}: Props & { value: number }) {
  const [min, max] = variable.range ?? [0, 100];
  const step = sliderStep(min, max);
  // Local text state so a student can type "1" on the way to "10" even
  // when 1 is below the min.
  const [text, setText] = useState<string>(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const clampAndCommit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setText(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    setText(String(clamped));
    if (clamped !== value) {
      onChange(clamped);
      onCommit?.(clamped);
    }
  };

  // Slider release. Reads the input's own value so the commit never lags
  // a pending state update from the last onChange.
  const commitSlider = (e: { currentTarget: HTMLInputElement }) =>
    onCommit?.(Number(e.currentTarget.value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-text">
          {variable.label}
          {variable.unit && (
            <span className="ml-1 text-xs text-text-soft">({variable.unit})</span>
          )}
        </label>
        <input
          type="number"
          value={text}
          min={min}
          max={max}
          step={step}
          disabled={disabled ?? false}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => clampAndCommit(e.target.value)}
          className="w-24 rounded-md border border-surface-border bg-surface px-2 py-1 text-sm text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled ?? false}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={commitSlider}
        onKeyUp={commitSlider}
        className="w-full accent-accent"
        aria-label={variable.label}
      />
      <div className="flex justify-between text-[11px] text-text-soft">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function CategoricalControl({
  variable,
  value,
  onChange,
  onCommit,
  disabled,
}: Props & { value: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-text">
        {variable.label}
      </label>
      <select
        value={value}
        disabled={disabled ?? false}
        onChange={(e) => {
          onChange(e.target.value);
          onCommit?.(e.target.value);
        }}
        aria-label={variable.label}
        className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {variable.options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

function BooleanControl({
  variable,
  value,
  onChange,
  onCommit,
  disabled,
}: Props & { value: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium text-text">{variable.label}</div>
      <div className="inline-flex rounded-md border border-surface-border overflow-hidden">
        {(["false", "true"] as const).map((v) => {
          const selected = v === String(value);
          return (
            <button
              key={v}
              type="button"
              disabled={disabled ?? false}
              onClick={() => {
                onChange(v === "true");
                onCommit?.(v === "true");
              }}
              className={cn(
                "px-3 py-1.5 text-sm transition",
                selected
                  ? "bg-accent text-text-inverse"
                  : "bg-surface text-text hover:bg-surface-muted",
                disabled && "opacity-60 cursor-not-allowed",
              )}
              aria-pressed={selected}
            >
              {v === "true" ? "Yes" : "No"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VariableControl(props: Props) {
  const { variable, value } = props;
  const v = value ?? defaultValue(variable);
  if (variable.type === "number") {
    return <NumberControl {...props} value={typeof v === "number" ? v : 0} />;
  }
  if (variable.type === "categorical") {
    return <CategoricalControl {...props} value={typeof v === "string" ? v : ""} />;
  }
  return <BooleanControl {...props} value={typeof v === "boolean" ? v : false} />;
}

/**
 * Read-only display of a variable's current value — used for
 * controlled_vars in a named-experiment tab.
 */
export function VariableReadonly({
  variable,
  value,
}: {
  variable: Variable;
  value: Scalar | undefined;
}) {
  const v = value ?? defaultValue(variable);
  const display =
    typeof v === "boolean"
      ? v ? "Yes" : "No"
      : typeof v === "string"
        ? v.replace(/_/g, " ")
        : String(v);
  return (
    <div className="rounded-md border border-surface-border bg-surface-muted p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-text">{variable.label}</div>
          {variable.unit && (
            <div className="text-[11px] text-text-soft">unit: {variable.unit}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-text">{display}</span>
          <span className="text-[10px] uppercase tracking-wider rounded-full bg-locked-muted text-locked px-2 py-0.5">
            held constant
          </span>
        </div>
      </div>
    </div>
  );
}
