import { defineConfig } from "vitest/config";
import * as path from "node:path";

/**
 * A hand-rolled `resolve.alias` for "@" (pointing at an absolute
 * `path.resolve(__dirname, "./src")`) resolved fine in the Linux
 * container but failed to resolve on Windows with the same byte-for-byte
 * config ("Cannot find module '@/...'") — an esbuild/Vite alias quirk
 * that a plain string alias apparently doesn't survive on that platform.
 * `vite-tsconfig-paths` reads the mapping straight from tsconfig.json's
 * own "paths" and is the officially recommended fix (it's what Vitest's
 * own "Cannot find module" error suggests), so it replaces the manual
 * alias here rather than being layered on top of it.
 *
 * `vite-tsconfig-paths` ships ESM-only, and this config file itself is
 * loaded through vite-node's CJS path — a static `import` throws
 * ("resolved to an ESM file, cannot be loaded by require"). A dynamic
 * `import()` works from either module system, so the plugin is loaded
 * that way inside an async config function.
 */
export default defineConfig(async () => {
  const { default: tsconfigPaths } = await import("vite-tsconfig-paths");
  return {
    plugins: [tsconfigPaths()],
    resolve: {
      alias: {
        // `server-only` throws on import outside an RSC context. Stub it
        // in tests so we can import server modules for unit testing. Not
        // part of tsconfig paths, so it still needs a manual alias.
        "server-only": path.resolve(
          __dirname,
          "./tests/stubs/server-only.ts",
        ),
      },
    },
    test: {
      globals: true,
      environment: "node",
      include: ["tests/**/*.test.ts"],
    },
  };
});
