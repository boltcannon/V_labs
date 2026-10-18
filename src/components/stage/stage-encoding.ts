/**
 * Visual encodings for simulation stages.
 *
 * These are the ONLY arithmetic a stage component may do, and none of it
 * is science: each function maps an engine output that is already
 * computed onto something drawable (text, opacity, animation speed).
 * Readings shown as text pass through `formatReading` unchanged apart
 * from rounding display noise past 4 decimals — never clamped.
 */

/** Text for a reading. `null` (no run, or undefined in the engine) → "—". */
export function formatReading(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(4)));
}

/**
 * Bulb glow in [0, 1]: the value as a fraction of the display scale (the
 * variable's declared range maximum). Saturates above the scale.
 */
export function glowLevel(value: number | null, scaleMax: number): number {
  if (value === null || !Number.isFinite(value) || !(scaleMax > 0)) return 0;
  return Math.min(1, Math.max(0, value / scaleMax));
}

/** Seconds per loop at full display scale, and the bounds for readability. */
export const FLOW_SECONDS_AT_SCALE = 0.25;
export const FLOW_MIN_SECONDS = 0.25;
export const FLOW_MAX_SECONDS = 12;

/**
 * Flow-dot loop duration: shorter (faster) for a larger value, so dot
 * speed is proportional to the reading until it hits the readability
 * bounds. `null` means no flow — zero, negative, or no reading.
 */
export function flowDurationSeconds(
  value: number | null,
  scaleMax: number,
): number | null {
  if (value === null || !Number.isFinite(value) || value <= 0 || !(scaleMax > 0)) {
    return null;
  }
  const seconds = FLOW_SECONDS_AT_SCALE / (value / scaleMax);
  return Math.min(FLOW_MAX_SECONDS, Math.max(FLOW_MIN_SECONDS, seconds));
}
