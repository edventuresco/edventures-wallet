import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The React plugin transforms .tsx test/component files; the environment
  // stays "node" by default. Component tests (tests/unit/ui, tests/unit/kid-send)
  // opt into jsdom per file with a leading `// @vitest-environment jsdom` comment.
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
