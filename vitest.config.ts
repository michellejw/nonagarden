import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "*.test.ts"],
    // Node 25 ships native Web Storage which shadows jsdom's localStorage,
    // breaking store tests. Disable it at the worker level so the flag applies
    // regardless of how vitest is invoked (npx vitest, IDE extension, CI, etc.).
    pool: "forks",
    poolOptions: { forks: { execArgv: ["--no-experimental-webstorage"] } },
  },
});
