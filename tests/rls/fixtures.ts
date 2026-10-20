import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient, signedInClient } from "./local-supabase";

type Row = Record<string, unknown>;

/**
 * Table cloisonnée par église, avec de quoi y créer une ligne et la modifier.
 * `key` est la colonne qui identifie une ligne de façon unique.
 */
export type TableSpec = {
  table: string;
  key: string;
  /** Ligne valide pour l'église `ctx`, sans la clé primaire générée. */
  build: (ctx: ChurchFixture) => Row;
  /** Modification anodine utilisée pour tester l'écriture. */
  patch: Row;
};

export type Account = { client: SupabaseClient; userId: string; memberId: string };

export type ChurchFixture = {
  id: string;
  slug: string;
  accounts: { admin: Account; responsable: Account; membre: Account; pastoral: Account };
  /** Une ligne existante par table, créée par la clé de service. */
  rows: Record<string, Row>;
};

const run = Math.random().toString(36).slice(2, 8);

async function insert(table: string, row: Row): Promise<Row> {
  const { data, error } = await serviceClient().from(table).insert(row).select().single();
  if (error) throw new Error(`Création ${table} : ${error.message}`);
  return data;
}

async function account(churchId: string, label: string, role: string, isPastoral = false): Promise<Account> {
  const { client, userId } = await signedInClient(`${label}-${run}@test.comora.fr`);
  await insert("church_memberships", { church_id: churchId, user_id: userId, role, is_pastoral: isPastoral });
  const member = await insert("members", { church_id: churchId, user_id: userId, first_name: label, last_name: "Test" });
  return { client, userId, memberId: member.id as string };
}

/** Tables cloisonnées par église et lignes de test associées. */
export const CHURCH_TABLES: TableSpec[] = [
  { table: "church_settings", key: "church_id", build: (c) => ({ church_id: c.id, tagline: "Bienvenue" }), patch: { tagline: "Modifié" } },
  { table: "church_schedules", key: "id", build: (c) => ({ church_id: c.id, day_of_week: "Dimanche", event_name: "Culte", start_time: "10:00" }), patch: { event_name: "Modifié" } },
  { table: "church_memberships", key: "id", build: (c) => ({ church_id: c.id, user_id: c.accounts.membre.userId, role: "membre" }), patch: { role: "admin" } },
  { table: "members", key: "id", build: (c) => ({ church_id: c.id, first_name: "Marie", last_name: "Durand" }), patch: { first_name: "Modifié" } },
  { table: "member_contacts", key: "member_id", build: (c) => ({ church_id: c.id, member_id: c.rows.members.id, email: "marie@exemple.fr", phone: "0600000000" }), patch: { phone: "0700000000" } },
  { table: "teams", key: "id", build: (c) => ({ church_id: c.id, name: `Louange ${Math.random()}` }), patch: { description: "Modifié" } },
  { table: "positions", key: "id", build: (c) => ({ church_id: c.id, team_id: c.rows.teams.id, name: `Chant ${Math.random()}` }), patch: { archived: true } },
  { table: "team_members", key: "id", build: (c) => ({ church_id: c.id, team_id: c.rows.teams.id, member_id: c.rows.members.id }), patch: { role: "leader" } },
  { table: "member_positions", key: "id", build: (c) => ({ church_id: c.id, position_id: c.rows.positions.id, member_id: c.rows.members.id }), patch: { created_at: "2027-01-01T00:00:00Z" } },
  { table: "plans", key: "id", build: (c) => ({ church_id: c.id, title: "Culte", service_date: "2027-01-10T09:00:00Z" }), patch: { title: "Modifié" } },
  { table: "plan_assignments", key: "id", build: (c) => ({ church_id: c.id, plan_id: c.rows.plans.id, member_id: c.accounts.membre.memberId, team_id: c.rows.teams.id }), patch: { status: "confirmed" } },
  { table: "blockout_dates", key: "id", build: (c) => ({ church_id: c.id, member_id: c.accounts.membre.memberId, start_date: "2027-02-01", end_date: "2027-02-05" }), patch: { reason: "Modifié" } },
  { table: "songs", key: "id", build: (c) => ({ church_id: c.id, title: "Chant" }), patch: { title: "Modifié" } },
  { table: "arrangements", key: "id", build: (c) => ({ church_id: c.id, song_id: c.rows.songs.id, name: "Original" }), patch: { name: "Modifié" } },
  { table: "plan_songs", key: "id", build: (c) => ({ church_id: c.id, plan_id: c.rows.plans.id, song_id: c.rows.songs.id }), patch: { key_selected: "G" } },
  { table: "plan_videos", key: "id", build: (c) => ({ church_id: c.id, plan_id: c.rows.plans.id, url: "https://exemple.fr/v" }), patch: { title: "Modifié" } },
  { table: "plan_announcements", key: "id", build: (c) => ({ church_id: c.id, plan_id: c.rows.plans.id, body: "Annonce" }), patch: { body: "Modifié" } },
  { table: "plan_sermons", key: "id", build: (c) => ({ church_id: c.id, plan_id: c.rows.plans.id, title: "Message", url: "https://exemple.fr/p.pdf" }), patch: { title: "Modifié" } },
  { table: "recurring_announcements", key: "id", build: (c) => ({ church_id: c.id, body: "Annonce" }), patch: { body: "Modifié" } },
  { table: "media_files", key: "id", build: (c) => ({ church_id: c.id, name: "fond.jpg", url: "https://exemple.fr/f.jpg" }), patch: { name: "Modifié" } },
  { table: "projection_settings", key: "church_id", build: (c) => ({ church_id: c.id }), patch: { bg_color: "#ffffff" } },
  { table: "tasks", key: "id", build: (c) => ({ church_id: c.id, team_id: c.rows.teams.id, title: "Tâche" }), patch: { status: "done" } },
  { table: "decisions", key: "id", build: (c) => ({ church_id: c.id, team_id: c.rows.teams.id, title: "Décision" }), patch: { status: "decided" } },
  { table: "prayer_requests", key: "id", build: (c) => ({ church_id: c.id, member_id: c.rows.members.id, subject: "Sujet confidentiel" }), patch: { status: "resolved" } },
  { table: "pastoral_notes", key: "id", build: (c) => ({ church_id: c.id, member_id: c.rows.members.id, notes: "Note confidentielle" }), patch: { notes: "Modifié" } },
  { table: "invite_tokens", key: "id", build: (c) => ({ church_id: c.id, token_hash: `hash-${Math.random()}` }), patch: { label: "Modifié" } },
];

/**
 * Tables de `public` sans `church_id`, testées à part ; ou tables de la
 * landing, hors de l'espace des églises.
 */
export const OTHER_TABLES = ["churches", "profiles", "platform_admins", "push_subscriptions", "waitlist", "invitations", "early_access_accounts"];

/** Crée une église complète : comptes de chaque rôle et une ligne par table. */
export async function seedChurch(label: string): Promise<ChurchFixture> {
  const church = await insert("churches", { name: `Église ${label}`, slug: `${label}-${run}` });
  const id = church.id as string;
  const accounts = {
    admin: await account(id, `${label}-admin`, "admin"),
    responsable: await account(id, `${label}-responsable`, "responsable"),
    membre: await account(id, `${label}-membre`, "membre"),
    pastoral: await account(id, `${label}-pastoral`, "membre", true),
  };
  const fixture: ChurchFixture = { id, slug: church.slug as string, accounts, rows: {} };
  for (const spec of CHURCH_TABLES) {
    if (spec.table === "church_memberships") {
      // Les appartenances existent déjà : on garde celle du membre
      const { data } = await serviceClient().from("church_memberships").select().eq("user_id", accounts.membre.userId).single();
      fixture.rows.church_memberships = data as Row;
      continue;
    }
    fixture.rows[spec.table] = await insert(spec.table, spec.build(fixture));
  }
  return fixture;
}
