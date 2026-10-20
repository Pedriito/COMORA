import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolve = {
  tsconfigPaths: true,
  alias: {
    // Le garde-fou « server-only » de Next n'a pas de sens dans les tests.
    "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
  },
};

export default defineConfig({
  resolve,
  test: {
    projects: [
      {
        // Logique serveur de la landing et des parcours publics
        resolve,
        test: {
          name: "serveur",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        // Espace de gestion, site d'église et design system (composants React)
        resolve,
        test: {
          name: "app",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./tests/support/jsdom-setup.ts"],
          include: [
            "app/**/*.test.{ts,tsx}",
            "lib/**/*.test.ts",
            "packages/**/*.test.{ts,tsx}",
          ],
        },
      },
    ],
  },
});
