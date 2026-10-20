import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Code repris de l'appli d'église d'origine, jamais passé à ESLint :
  // ces règles signalent une dette (types `any`, apostrophes, effets React)
  // à résorber au fil des étapes, sans bloquer le lint. Le nouveau code
  // ajouté hors de ces dossiers reste soumis aux règles strictes.
  {
    files: [
      "app/espace/**",
      "app/partage/**",
      "app/api/**",
      "app/_components/**",
      "tests/helpers/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
    },
  },
  // Override default ignores of eslint-config-next:
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
