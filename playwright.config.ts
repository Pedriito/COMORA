import { defineConfig, devices } from "@playwright/test";

/** Valeurs de test : volontairement reconnaissables pour la recherche de fuites. */
export const E2E_ADMIN_PASSWORD = "e2e-Mot2Passe-ne-doit-jamais-fuiter";
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // Build de production : c'est lui qui est déployé, et c'est lui qu'on inspecte.
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      ADMIN_PASSWORD: E2E_ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET: "e2e-secret-de-session-suffisamment-long-0123456789",
      // Aucun Supabase ni Resend : on teste l'interface et la sécurité, pas la base.
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
      SUPABASE_SECRET_KEY: "",
    },
  },
});
