import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    /*
     * Node stays the default so the domain, application, and route tests keep
     * running without a DOM they do not need. Component tests opt in per file
     * with a `@vitest-environment jsdom` docblock.
     */
    environment: "node",
  },
});
