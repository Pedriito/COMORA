import { beforeAll, describe, expect, it } from "vitest";
import { seedChurch, type ChurchFixture } from "./fixtures";
import { anonClient, serviceClient } from "./local-supabase";

/* Fichiers et canaux temps réel : même cloisonnement que les tables. */

let A: ChurchFixture;
let B: ChurchFixture;
const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
const pdf = new Blob(["%PDF-1.4 test"], { type: "application/pdf" });

beforeAll(async () => {
  A = await seedChurch("stock-a");
  B = await seedChurch("stock-b");
  await serviceClient().storage.from("church-private").upload(`${B.id}/predications/message.pdf`, pdf);
  await serviceClient().storage.from("church-public").upload(`${B.id}/annonces/affiche.png`, png);
}, 180_000);

describe("stockage", () => {
  it("un responsable dépose un fichier dans le dossier de son église", async () => {
    const { error } = await A.accounts.responsable.client.storage.from("church-public").upload(`${A.id}/annonces/${Date.now()}.png`, png);
    expect(error).toBeNull();
  });

  it("un compte de A ne dépose rien dans le dossier de B", async () => {
    for (const [bucket, file] of [["church-public", png], ["church-private", pdf]] as const) {
      const { error } = await A.accounts.admin.client.storage.from(bucket).upload(`${B.id}/intrus-${Date.now()}`, file);
      expect(error, bucket).not.toBeNull();
    }
  });

  it("un simple membre ne dépose pas de fichier", async () => {
    const { error } = await A.accounts.membre.client.storage.from("church-public").upload(`${A.id}/annonces/${Date.now()}.png`, png);
    expect(error).not.toBeNull();
  });

  it("un fichier hors d'un dossier d'église est refusé", async () => {
    const { error } = await A.accounts.admin.client.storage.from("church-public").upload(`divers/${Date.now()}.png`, png);
    expect(error).not.toBeNull();
  });

  it("un compte de A ne lit ni ne supprime les documents privés de B", async () => {
    const attacker = A.accounts.admin.client;
    const { data } = await attacker.storage.from("church-private").download(`${B.id}/predications/message.pdf`);
    expect(data).toBeNull();
    const { data: signed } = await attacker.storage.from("church-private").createSignedUrl(`${B.id}/predications/message.pdf`, 60);
    expect(signed).toBeNull();
    await attacker.storage.from("church-private").remove([`${B.id}/predications/message.pdf`]);
    await attacker.storage.from("church-public").remove([`${B.id}/annonces/affiche.png`]);
    const { data: still } = await serviceClient().storage.from("church-private").list(`${B.id}/predications`);
    expect(still?.map((f) => f.name)).toContain("message.pdf");
    const { data: stillPublic } = await serviceClient().storage.from("church-public").list(`${B.id}/annonces`);
    expect(stillPublic?.map((f) => f.name)).toContain("affiche.png");
  });

  it("les documents privés ne sont pas lisibles sans compte", async () => {
    const { data } = await anonClient().storage.from("church-private").download(`${B.id}/predications/message.pdf`);
    expect(data).toBeNull();
  });

  it("un membre de B lit les documents privés de son église", async () => {
    const { data } = await B.accounts.membre.client.storage.from("church-private").createSignedUrl(`${B.id}/predications/message.pdf`, 60);
    expect(data?.signedUrl).toBeTruthy();
  });
});

describe("temps réel", () => {
  async function subscribe(client: ReturnType<typeof anonClient>, topic: string) {
    const { data } = await client.auth.getSession();
    if (data.session) await client.realtime.setAuth(data.session.access_token);
    return new Promise<string>((resolve) => {
      const channel = client.channel(topic, { config: { private: true } });
      const timer = setTimeout(() => resolve("TIMED_OUT"), 8_000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR") {
          clearTimeout(timer);
          void client.removeChannel(channel);
          resolve(status);
        }
      });
    });
  }

  it("un membre écoute le canal de projection de son église", async () => {
    expect(await subscribe(A.accounts.membre.client, `church:${A.id}:projection`)).toBe("SUBSCRIBED");
  });

  it("un compte de A ne peut pas écouter le canal de B", async () => {
    expect(await subscribe(A.accounts.admin.client, `church:${B.id}:projection`)).not.toBe("SUBSCRIBED");
  });

  it("sans compte, aucun canal privé n'est accessible", async () => {
    expect(await subscribe(anonClient(), `church:${A.id}:projection`)).not.toBe("SUBSCRIBED");
  });
});
