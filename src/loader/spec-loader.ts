/**
 * Spec loader — reads a YAML file, validates it against the Zod schema, and
 * returns a strongly-typed LabSpec. The loader is the only sanctioned entry
 * point into the engine: a spec that has not been validated here must not be
 * handed to `runLab()`.
 */

import * as fs from "node:fs";
import yaml from "js-yaml";
import { labSpecSchema } from "../schema/lab-spec.zod";
import {
  asValidatedLabSpec,
  type LabSpec,
  type ValidatedLabSpec,
} from "../schema/lab-spec";

export class SpecValidationError extends Error {
  constructor(
    public spec_path: string,
    public issues: Array<{ path: string; message: string }>,
  ) {
    const detail = issues
      .map((i) => `  - [${i.path}] ${i.message}`)
      .join("\n");
    super(`LabSpec '${spec_path}' failed validation:\n${detail}`);
    this.name = "SpecValidationError";
  }
}

export function parseLabSpec(
  yamlText: string,
  sourcePath = "<inline>",
): ValidatedLabSpec {
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlText);
  } catch (err) {
    throw new Error(
      `Failed to parse YAML for '${sourcePath}': ${(err as Error).message}`,
    );
  }
  const result = labSpecSchema.safeParse(parsed);
  if (!result.success) {
    throw new SpecValidationError(
      sourcePath,
      result.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    );
  }
  // Zod under `exactOptionalPropertyTypes` infers optional fields as
  // `T | undefined`, whereas our canonical LabSpec type declares them as
  // `T?`. The two are structurally identical at runtime; cast at the
  // boundary and then brand — the brand is the ticket the engine accepts.
  const spec = result.data as unknown as LabSpec;
  return asValidatedLabSpec(spec);
}

export function loadLabSpecFromFile(filePath: string): ValidatedLabSpec {
  const text = fs.readFileSync(filePath, "utf8");
  return parseLabSpec(text, filePath);
}
