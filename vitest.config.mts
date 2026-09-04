import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, ".")
    }
  },
  test: {
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/components/**/*.test.tsx"],
    setupFiles: ["tests/components/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 84,
        branches: 75
      }
    }
  }
});
