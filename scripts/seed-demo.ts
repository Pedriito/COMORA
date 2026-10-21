/*
 * Jeu de démonstration pour visiter l'espace : une église fictive avec équipes,
 * personnes, plans de culte, affectations, chants et annonces.
 * Toutes les données sont inventées ; un seul chant (du domaine public).
 *
 *   npx tsx scripts/seed-demo.ts
 *
 * Réservé à la base LOCALE (`supabase start`) : le script refuse toute autre URL.
 * Relancé, il repart d'une église « demo » propre.
 */
import { serviceClient } from "../tests/rls/local-supabase";

const PASSWORD = "Demo-Comora-2027!";
const SLUG = "demo";
const ACCOUNTS = [
  { email: "admin@demo.comora.test", first: "Camille", last: "Martin", role: "admin", pastoral: true, label: "administratrice + pastorale" },
  { email: "responsable@demo.comora.test", first: "Julien", last: "Bernard", role: "responsable", pastoral: false, label: "coordinateur" },
  { email: "membre@demo.comora.test", first: "Léa", last: "Moreau", role: "membre", pastoral: false, label: "membre" },
] as const;

const db = serviceClient();

function must<T>(result: { data: T; error: { message: string } | null }, what: string): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`${what} : ${result.error?.message ?? "aucune donnée"}`);
  }
  return result.data as NonNullable<T>;
}

/** Prochain dimanche à `hour` h, dans `weeks` semaines, en UTC (Paris ≈ UTC+1/+2). */
function sunday(weeks: number, hourUtc = 9) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7 || 7) + weeks * 7);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

const CHART = `[Couplet 1]
G              C         G
Amazing grace, how sweet the sound
G                 D
That saved a wretch like me
G                C           G
I once was lost, but now am found
G         D          G
Was blind, but now I see

[Refrain]
G              C         G
Amazing grace, how sweet the sound
G         D          G
Was blind, but now I see`;

async function reset() {
  const { data: old } = await db.from("churches").select("id").eq("slug", SLUG).maybeSingle();
  if (old) await db.from("churches").delete().eq("id", old.id);
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
  for (const u of users?.users ?? []) {
    if (u.email?.endsWith("@demo.comora.test")) await db.auth.admin.deleteUser(u.id);
  }
}

async function main() {
  await reset();

  const church = must(
    await db.from("churches").insert({
      name: "Église de démonstration", slug: SLUG, city: "Lyon", country: "FR", size_bracket: "30_100",
      offer: "communaute", billing_status: "trialing", trial_ends_at: new Date(Date.now() + 30 * 864e5).toISOString(),
    }).select("id").single(),
    "église",
  );
  const churchId = church.id;

  await db.from("church_settings").insert({
    church_id: churchId, tagline: "Une église pour tous, ouverte à tous", address_street: "12 rue de l'Exemple",
    address_zip: "69000", address_city: "Lyon", address_dept: "Rhône", email: "contact@demo.comora.test",
    pastors_names: "Camille et Julien", maps_url: "https://maps.google.com/?q=Lyon",
  });
  await db.from("church_schedules").insert([
    { church_id: churchId, sort_order: 1, day_of_week: "Dimanche", event_name: "Culte", start_time: "10:30", end_time: "12:00", subtitle: "Louange, message et café" },
    { church_id: churchId, sort_order: 2, day_of_week: "Mercredi", event_name: "Réunion de prière", start_time: "19:30", end_time: "20:30" },
  ]);

  // Comptes de connexion
  const memberOf: Record<string, string> = {};
  for (const a of ACCOUNTS) {
    const { data, error } = await db.auth.admin.createUser({
      email: a.email, password: PASSWORD, email_confirm: true, user_metadata: { first_name: a.first, last_name: a.last },
    });
    if (error || !data.user) throw new Error(`${a.email} : ${error?.message}`);
    await db.from("church_memberships").insert({ church_id: churchId, user_id: data.user.id, role: a.role, is_pastoral: a.pastoral });
    const m = must(
      await db.from("members").insert({ church_id: churchId, user_id: data.user.id, first_name: a.first, last_name: a.last, desired_frequency: "twice_month" }).select("id").single(),
      a.email,
    );
    await db.from("member_contacts").insert({ member_id: m.id, church_id: churchId, email: a.email, city: "Lyon" });
    await db.from("profiles").update({ first_name: a.first, last_name: a.last, active_church_id: churchId }).eq("id", data.user.id);
    memberOf[a.email] = m.id;
  }

  // Personnes sans compte
  const names: [string, string][] = [["Sarah", "Dubois"], ["Thomas", "Petit"], ["Inès", "Roux"], ["Mathieu", "Leroy"], ["Élise", "Faure"], ["Paul", "Girard"], ["Nina", "Lambert"], ["Hugo", "Fontaine"]];
  const people = must(
    await db.from("members").insert(names.map(([first_name, last_name]) => ({ church_id: churchId, first_name, last_name }))).select("id, first_name"),
    "personnes",
  );
  const person = (first: string) => people.find((p) => p.first_name === first)!.id;

  // Équipes et postes
  const teams = must(
    await db.from("teams").insert([
      { church_id: churchId, name: "Louange", allows_guests: false },
      { church_id: churchId, name: "Accueil", allows_guests: false },
      { church_id: churchId, name: "Technique", allows_guests: false },
      { church_id: churchId, name: "Enfants", allows_guests: true },
    ]).select("id, name"),
    "équipes",
  );
  const team = (name: string) => teams.find((t) => t.name === name)!.id;
  const positions = must(
    await db.from("positions").insert([
      { church_id: churchId, team_id: team("Louange"), name: "Chant lead" },
      { church_id: churchId, team_id: team("Louange"), name: "Guitare" },
      { church_id: churchId, team_id: team("Louange"), name: "Piano" },
      { church_id: churchId, team_id: team("Louange"), name: "Batterie" },
      { church_id: churchId, team_id: team("Technique"), name: "Son" },
      { church_id: churchId, team_id: team("Technique"), name: "Projection" },
    ]).select("id, name"),
    "postes",
  );
  const pos = (name: string) => positions.find((p) => p.name === name)!.id;

  await db.from("team_members").insert([
    { church_id: churchId, team_id: team("Louange"), member_id: memberOf["membre@demo.comora.test"], role: "leader" },
    { church_id: churchId, team_id: team("Louange"), member_id: person("Sarah") },
    { church_id: churchId, team_id: team("Louange"), member_id: person("Thomas") },
    { church_id: churchId, team_id: team("Louange"), member_id: person("Inès") },
    { church_id: churchId, team_id: team("Accueil"), member_id: person("Mathieu") },
    { church_id: churchId, team_id: team("Accueil"), member_id: person("Élise") },
    { church_id: churchId, team_id: team("Technique"), member_id: person("Paul") },
    { church_id: churchId, team_id: team("Technique"), member_id: memberOf["responsable@demo.comora.test"], role: "leader" },
  ]);
  await db.from("member_positions").insert([
    { church_id: churchId, member_id: person("Sarah"), position_id: pos("Chant lead") },
    { church_id: churchId, member_id: person("Thomas"), position_id: pos("Guitare") },
    { church_id: churchId, member_id: person("Inès"), position_id: pos("Piano") },
    { church_id: churchId, member_id: person("Paul"), position_id: pos("Son") },
  ]);

  // Chant
  const song = must(await db.from("songs").insert({ church_id: churchId, title: "Amazing Grace", ccli: "—", themes: "Grâce" }).select("id").single(), "chant");
  const arrangement = must(
    await db.from("arrangements").insert({ church_id: churchId, song_id: song.id, name: "Original", bpm: 72, chord_chart: CHART, chord_chart_key: "G", keys_available: ["G", "A", "C"] }).select("id").single(),
    "arrangement",
  );

  // Plans de culte
  const plans = must(
    await db.from("plans").insert([
      { church_id: churchId, title: "Culte du dimanche", service_date: sunday(0), plan_type: "sunday_service" },
      { church_id: churchId, title: "Culte du dimanche", service_date: sunday(1), plan_type: "sunday_service" },
      { church_id: churchId, title: "Réunion de prière", service_date: sunday(0, 17), plan_type: "prayer_meeting" },
    ]).select("id, plan_type, service_date").order("service_date"),
    "plans",
  );
  const next = plans.find((p) => p.plan_type === "sunday_service")!;

  await db.from("plan_songs").insert({ church_id: churchId, plan_id: next.id, song_id: song.id, arrangement_id: arrangement.id, key_selected: "G", order_index: 0 });
  await db.from("plan_announcements").insert([
    { church_id: churchId, plan_id: next.id, title: "Repas partagé", body: "Dimanche prochain, repas partagé après le culte : chacun apporte un plat.", order_index: 0 },
  ]);
  await db.from("recurring_announcements").insert({ church_id: churchId, title: "Bienvenue", body: "Merci d'être là ! Café et thé au fond de la salle.", order_index: 0 });

  await db.from("plan_assignments").insert([
    { church_id: churchId, plan_id: next.id, member_id: person("Sarah"), team_id: team("Louange"), position_id: pos("Chant lead"), status: "confirmed" },
    { church_id: churchId, plan_id: next.id, member_id: person("Thomas"), team_id: team("Louange"), position_id: pos("Guitare"), status: "pending" },
    { church_id: churchId, plan_id: next.id, member_id: person("Inès"), team_id: team("Louange"), position_id: pos("Piano"), status: "declined" },
    { church_id: churchId, plan_id: next.id, member_id: person("Paul"), team_id: team("Technique"), position_id: pos("Son"), status: "confirmed" },
    { church_id: churchId, plan_id: next.id, member_id: person("Mathieu"), team_id: team("Accueil"), status: "pending" },
    { church_id: churchId, plan_id: next.id, member_id: memberOf["membre@demo.comora.test"], team_id: team("Louange"), position_id: pos("Batterie"), status: "pending" },
    { church_id: churchId, plan_id: next.id, external_name: "Invité Dupont", external_email: "invite@demo.comora.test", team_id: team("Enfants"), status: "pending" },
  ]);
  await db.from("blockout_dates").insert({ church_id: churchId, member_id: person("Élise"), start_date: sunday(0).slice(0, 10), end_date: sunday(1).slice(0, 10), reason: "Vacances" });

  // Tâches, décisions, pastorale (fictives)
  await db.from("tasks").insert({ church_id: churchId, team_id: team("Technique"), title: "Changer les piles des micros", due_date: sunday(0).slice(0, 10) });
  await db.from("decisions").insert({ church_id: churchId, team_id: team("Louange"), title: "Ajouter une répétition le jeudi ?", context: "Proposition de l'équipe", status: "pending" });
  await db.from("prayer_requests").insert({ church_id: churchId, member_id: person("Nina"), subject: "Sujet de prière fictif", notes: "Donnée de démonstration", status: "active" });

  console.log("\nÉglise de démonstration prête.\n");
  for (const a of ACCOUNTS) console.log(`  ${a.email.padEnd(32)} ${a.label}`);
  console.log(`\n  Mot de passe pour tous : ${PASSWORD}`);
  console.log(`  Site public : /sites/${SLUG}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
