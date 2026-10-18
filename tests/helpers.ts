import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLabSpecFromFile } from "../src/loader/spec-loader";
import type { ValidatedLabSpec } from "../src/schema/lab-spec";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..");

export function loadSpec(rel: string): ValidatedLabSpec {
  return loadLabSpecFromFile(path.join(REPO_ROOT, rel));
}

export const CLASS_6_PATH = "src/specs/class-6-biology-habitat-explorer.yaml";
export const CLASS_8_PATH = "src/specs/class-8-physics-pressure.yaml";
export const CLASS_9_PATH = "src/specs/class-9-physics-motion.yaml";
export const CLASS_10_PATH = "src/specs/class-10-physics-electricity.yaml";
