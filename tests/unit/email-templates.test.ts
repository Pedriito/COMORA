import { describe, expect, it } from "vitest";
import { escapeHtml, invitationEmail, refusalEmail } from "@/lib/email/templates";

describe("e-mails Comora", () => {
  const link = "https://comora.fr/inscription/abc_DEF-123";

  it("e-mail d'invitation : lien, échéance et marque", () => {
    const email = invitationEmail({
      nom: "Marie Dupont",
      eglise: "Église du Centre",
      link,
      expiresAt: new Date("2026-10-22T10:00:00Z"),
    });
    expect(email.subject).toBe("Église du Centre rejoint les églises fondatrices de Comora");
    expect(email.html).toContain(`href="${link}"`);
    expect(email.html).toContain("Créer mon compte");
    expect(email.html).toContain("22 octobre");
    expect(email.html).toContain("Bonjour Marie,");
    // Branding : couleurs, logo et signature Comora
    expect(email.html).toContain("#16241f");
    expect(email.html).toContain("#e2693c");
    expect(email.html).toContain("/email/logo.png");
    expect(email.html).toContain("Votre église, rassemblée.");
    expect(email.text).toContain(link);
  });

  it("e-mail de refus : accès à la version publique, sans lien d'inscription", () => {
    const email = refusalEmail({ nom: "Paul", eglise: "Église Nord" });
    expect(email.subject).toBe("Votre demande d’accès à Comora");
    expect(email.html).toContain("lorsque la version publique sera en ligne");
    expect(email.text).toContain("lorsque la version publique sera en ligne");
    expect(email.html).not.toContain("/inscription/");
    expect(email.html).toContain("#16241f");
  });

  it("échappe ce que les visiteurs ont saisi", () => {
    const email = refusalEmail({ nom: "<script>alert(1)</script>", eglise: 'Église "<b>"' });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Église &quot;&lt;b&gt;&quot;");
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
