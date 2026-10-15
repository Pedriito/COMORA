"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { decide, type DecisionState } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { cx } from "@/components/ui/cx";
import type { AccessRequest, RequestStatus } from "@/lib/admin/store";
import { COUNTRY_OPTIONS, SIZE_OPTIONS } from "@/lib/waitlist";

/** Nombre de places d'églises fondatrices annoncé sur le site. */
const FOUNDER_SLOTS = 20;

const TABS: { status: RequestStatus; label: string }[] = [
  { status: "en_attente", label: "En attente" },
  { status: "acceptee", label: "Acceptées" },
  { status: "refusee", label: "Refusées" },
];

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

type Notice = { message: string; ok: boolean; link?: string; eglise?: string };

export function RequestBoard({ requests }: { requests: AccessRequest[] }) {
  const [tab, setTab] = useState<RequestStatus>("en_attente");
  const [pays, setPays] = useState("");
  const [taille, setTaille] = useState("");
  const [multiSites, setMultiSites] = useState(false);
  const [visio, setVisio] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const counts = useMemo(() => {
    const result = { en_attente: 0, acceptee: 0, refusee: 0 };
    for (const request of requests) result[request.statut] += 1;
    return result;
  }, [requests]);

  const visible = requests.filter(
    (request) =>
      request.statut === tab &&
      (!pays || request.pays === pays) &&
      (!taille || request.taille === taille) &&
      (!multiSites || request.multi_sites) &&
      (!visio || request.visio),
  );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-[17px] text-slate">
        <strong className="text-dark">
          {counts.acceptee} / {FOUNDER_SLOTS}
        </strong>{" "}
        églises fondatrices acceptées · {counts.en_attente} demande{counts.en_attente > 1 ? "s" : ""} en attente
      </p>

      {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}

      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Statut" className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-white p-1">
          {TABS.map((item) => (
            <button
              key={item.status}
              type="button"
              role="tab"
              aria-selected={tab === item.status}
              onClick={() => setTab(item.status)}
              className={cx(
                "flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[15px] whitespace-nowrap sm:px-4 font-semibold transition-colors",
                tab === item.status ? "bg-dark text-white" : "text-dark hover:bg-sand",
              )}
            >
              {item.label}
              <span className="text-[13px] opacity-70">{counts[item.status]}</span>
            </button>
          ))}
        </div>
        <FilterSelect label="Pays" value={pays} onChange={setPays} options={COUNTRY_OPTIONS} />
        <FilterSelect label="Membres" value={taille} onChange={setTaille} options={SIZE_OPTIONS} />
        <FilterCheck checked={multiSites} onChange={setMultiSites}>
          Plusieurs sites
        </FilterCheck>
        <FilterCheck checked={visio} onChange={setVisio}>
          Dispo visio
        </FilterCheck>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-10 text-center text-slate">
          Aucune demande ici pour le moment.
        </p>
      ) : (
        <ul className="grid gap-5 lg:grid-cols-2">
          {visible.map((request) => (
            <RequestCard key={request.id} request={request} onResult={setNotice} />
          ))}
        </ul>
      )}
    </div>
  );
}

function RequestCard({ request, onResult }: { request: AccessRequest; onResult: (notice: Notice) => void }) {
  const facts: [string, ReactNode][] = [
    ["Membres", request.taille],
    ["Bénévoles", request.benevoles],
    ["Cultes / semaine", request.cultes],
    ["Plusieurs sites", request.multi_sites ? "Oui" : "Non"],
    ["Besoin n°1", request.priorite],
    ["Outils actuels", request.outil],
    ["Visio 30 min", request.visio ? "Disponible" : "Non précisé"],
    ["Source", request.source],
  ];

  return (
    <li className="flex min-w-0 flex-col gap-5 rounded-3xl border border-line bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-display text-[28px] leading-[1.05] font-semibold break-words">{request.eglise}</h2>
          <p className="text-[15px] text-slate">
            {request.ville}
            {request.pays ? ` · ${request.pays}` : ""}
          </p>
        </div>
        <span className="text-[13px] whitespace-nowrap text-muted">
          {dateFormat.format(new Date(request.created_at))}
        </span>
      </div>

      <p className="text-[15px] [overflow-wrap:anywhere]">
        <span className="font-semibold">{request.nom}</span>
        {request.role ? ` · ${request.role}` : ""}
        <br />
        <a href={`mailto:${request.email}`} className="text-teal-dark underline-offset-2 hover:underline">
          {request.email}
        </a>
      </p>

      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-[14px] [overflow-wrap:anywhere]">
        {facts.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{label}</dt>
            <dd className="text-dark">{value || "—"}</dd>
          </div>
        ))}
      </dl>

      {request.ministeres.length > 0 && (
        <ul aria-label="Équipes actives" className="flex flex-wrap gap-1.5">
          {request.ministeres.map((ministere) => (
            <li key={ministere} className="rounded-full bg-teal-50 px-2.5 py-1 text-[13px] font-semibold text-teal-dark">
              {ministere}
            </li>
          ))}
        </ul>
      )}

      <DecisionPanel request={request} onResult={onResult} />
    </li>
  );
}

function DecisionPanel({ request, onResult }: { request: AccessRequest; onResult: (notice: Notice) => void }) {
  // La carte change d'onglet après la décision : le résultat est remonté au tableau.
  const [state, formAction, pending] = useActionState(async (previous: DecisionState, data: FormData) => {
    const result = await decide(previous, data);
    if (result) {
      onResult({
        ok: result.ok,
        message: result.message,
        link: result.ok ? result.link : undefined,
        eglise: request.eglise,
      });
    }
    return result;
  }, null);

  const confirmRefusal = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(`Refuser ${request.eglise} ? Un e-mail lui sera envoyé.`)) event.preventDefault();
  };

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t border-line-soft pt-5">
      <input type="hidden" name="id" value={request.id} />
      {request.statut === "en_attente" ? (
        <div className="flex flex-wrap gap-2.5">
          <button
            type="submit"
            name="intent"
            value="accepter"
            disabled={pending}
            className="h-11 cursor-pointer rounded-full bg-coral px-5 text-[15px] font-semibold text-white hover:bg-coral/90 disabled:opacity-60"
          >
            Accepter
          </button>
          <button
            type="submit"
            name="intent"
            value="refuser"
            disabled={pending}
            onClick={confirmRefusal}
            className="h-11 cursor-pointer rounded-full border border-line px-5 text-[15px] font-semibold text-dark hover:bg-sand disabled:opacity-60"
          >
            Refuser
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={request.statut === "acceptee" ? "green" : "neutral"} size="md">
            {request.statut === "acceptee" ? "Acceptée" : "Refusée"}
            {request.decided_at ? ` le ${dateFormat.format(new Date(request.decided_at))}` : ""}
          </Badge>
          <Badge tone={request.email_sent_at ? "teal" : "amber"} size="md">
            {request.email_sent_at ? "E-mail envoyé" : "E-mail non envoyé"}
          </Badge>
          <button
            type="submit"
            name="intent"
            value="renvoyer"
            disabled={pending}
            className="cursor-pointer text-[14px] font-semibold text-teal-dark underline-offset-2 hover:underline disabled:opacity-60"
          >
            {request.statut === "acceptee" ? "Nouveau lien + renvoyer l’e-mail" : "Renvoyer l’e-mail"}
          </button>
        </div>
      )}
      {pending && <p className="text-[14px] text-muted">En cours…</p>}
      {state && !state.ok && <p className="text-[14px] font-semibold text-coral-deep">{state.message}</p>}
    </form>
  );
}

function NoticeBanner({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!notice.link) return;
    await navigator.clipboard.writeText(notice.link);
    setCopied(true);
  }

  return (
    <div
      role="status"
      className={cx(
        "flex flex-col gap-3 rounded-2xl border p-5",
        notice.ok ? "border-teal/30 bg-teal-50" : "border-coral/30 bg-coral-50",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <p className={cx("min-w-0 font-semibold [overflow-wrap:anywhere]", notice.ok ? "text-teal-dark" : "text-coral-deep")}>{notice.message}</p>
        <button type="button" onClick={onClose} aria-label="Fermer" className="cursor-pointer text-[20px] leading-none text-muted">
          ×
        </button>
      </div>
      {notice.link && (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-slate">
            Lien d’inscription pour {notice.eglise} (affiché une seule fois, valable 14 jours) :
          </span>
          <div className="flex gap-2">
            <input
              readOnly
              value={notice.link}
              aria-label="Lien d’inscription"
              onFocus={(event) => event.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 font-mono text-base sm:text-[13px]"
            />
            <button
              type="button"
              onClick={copy}
              className="h-10 shrink-0 cursor-pointer rounded-full bg-dark px-4 text-[14px] font-semibold text-white"
            >
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 max-w-full rounded-full border border-line bg-white px-4 text-base sm:text-[14px]"
    >
      <option value="">{label} : tous</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function FilterCheck({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-4 text-[14px]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-coral"
      />
      {children}
    </label>
  );
}
