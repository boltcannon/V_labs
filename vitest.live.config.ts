/**
 * TEMPORARY — Checkpoint 3 live-behaviour verification only.
 * Separate from vitest.config.ts's `tests/**` include so these three
 * live-API calls never run as part of the normal (hermetic, mocked)
 * test suite. Deleted after docs/tutor-behaviour-log.md is produced.
 *
 * See vitest.config.ts for why `vite-tsconfig-paths` is loaded via a
 * dynamic import inside an async config function.
 */
import { defineConfig } from "vitest/config";
import * as path from "node:path";

export default defineConfig(async () => {
  const { default: tsconfigPaths } = await import("vite-tsconfig-paths");
  return {
    plugins: [tsconfigPaths()],
    resolve: {
      alias: {
        "server-only": path.resolve(
          __dirname,
          "./tests/stubs/server-only.ts",
        ),
      },
    },
    test: {
      globals: true,
      environment: "node",
      include: ["scripts/live-behaviour.test.ts"],
    },
  };
});
