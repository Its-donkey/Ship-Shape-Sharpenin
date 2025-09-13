// packages/validation/vitest.config.ts
import { defineConfig, mergeConfig } from "vitest/config";
import base from "../../vitest.base";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // Workspace-specific overrides (uncomment as needed)
      // setupFiles: ["./test/setup.ts"],
      // environment: "node", // already set in vitest.base.ts
      // include: ["src/**/*.test.ts"], // already set in vitest.base.ts
    },
  })
);
