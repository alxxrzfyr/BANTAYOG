import { defineConfig } from "vitest/config";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // View tests render with react-dom/server in the node environment (no DOM library).
    include: ["lib/**/*.test.ts", "app/api/**/*.test.ts", "components/**/*.test.tsx"],
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts", "lib/env.ts"],
    },
  },
  // tsconfig sets "jsx": "preserve" for Next; tests need esbuild to compile JSX.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@repo": repoRoot,
      "@": path.resolve(__dirname, "."),
      "@bantayog/schema/analytics": path.resolve(__dirname, "../../packages/schema/src/analytics.ts"),
      "@bantayog/schema/offline": path.resolve(__dirname, "../../packages/schema/src/offline.ts"),
      "@bantayog/schema": path.resolve(__dirname, "../../packages/schema/src/index.ts"),
      "@bantayog/db": path.resolve(__dirname, "../../packages/db/src/index.ts"),
    },
  },
});
