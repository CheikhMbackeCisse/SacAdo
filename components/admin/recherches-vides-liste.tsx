"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChampSelect } from "@/components/ui/champ-select";
import {
  marquerRecherche,
  rattacherAuGroupe,
  reouvrirRecherche,
  type RechercheVide,
} from "@/lib/admin/recherches-actions";
import type { GroupeSynonymes } from "@/lib/admin/synonymes-actions";

const CHAMP =
  "min-h-11 w-full rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

const LIBELLE_TRAITEMENT: Record<string, string> = {
  synonyme: "Synonyme ajouté",
  a_sourcer: "À sourcer",
  ignore: "Ignoré",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: "Africa/Dakar",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function RecherchesVidesListe({
  recherches,
  groupes,
}: {
  recherches: RechercheVide[];
  groupes: GroupeSynonymes[];
}) {
  const [onglet, setOnglet] = useState<"file" | "traites">("file");

  const file = useMemo(() => recherches.filter((r) => r.traitement === null), [recherches]);
  const traites = useMemo(() => recherches.filter((r) => r.traitement !== null), [recherches]);
  const liste = onglet === "file" ? file : traites;

  // Un groupe se reconnaît à ses termes, pas à son numéro.
  const options = useMemo(
    () =>
      groupes.map((g) => ({
        value: String(g.groupe),
        label: g.termes.map((t) => t.terme).join(", "),
      })),
    [groupes],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Onglet actif={onglet === "file"} onClick={() => setOnglet("file")}>
          À traiter ({file.length})
        </Onglet>
        <Onglet actif={onglet === "traites"} onClick={() => setOnglet("traites")}>
          Traités ({traites.length})
        </Onglet>
      </div>

      {liste.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          {onglet === "file"
            ? "Aucune recherche restée sans réponse sur les 30 derniers jours."
            : "Aucun terme traité pour l’instant."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {liste.map((r) => (
            <LigneRecherche key={r.terme} recherche={r} options={options} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Onglet({
  actif,
  onClick,
  children,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
        actif ? "bg-brand/10 text-brand" : "border border-ink/15 text-ink/60 hover:bg-ink/5"
      }`}
    >
      {children}
    </button>
  );
}

function LigneRecherche({
  recherche,
  options,
}: {
  recherche: RechercheVide;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [groupe, setGroupe] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const lancer = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    setEnCours(true);
    setErreur(null);
    const res = await action();
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error ?? "Action impossible.");
      return;
    }
    router.refresh();
  };

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-ink/10 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">« {recherche.terme} »</p>
          <p className="text-xs text-ink/50">
            {recherche.occurrences} recherche{recherche.occurrences > 1 ? "s" : ""} · dernière le{" "}
            {formatDate(recherche.derniere)}
          </p>
        </div>
        {recherche.traitement && (
          <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-medium text-ink/60">
            {LIBELLE_TRAITEMENT[recherche.traitement] ?? recherche.traitement}
          </span>
        )}
      </div>

      {recherche.traitement === null ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ChampSelect
              ariaLabel={`Groupe de synonymes pour « ${recherche.terme} »`}
              placeholder="Rattacher à un groupe de synonymes…"
              className={CHAMP}
              wrapperClassName="min-w-0 flex-1"
              value={groupe}
              onChange={setGroupe}
              options={options}
            />
            <button
              type="button"
              disabled={enCours || !groupe}
              onClick={() => lancer(() => rattacherAuGroupe(recherche.terme, Number(groupe)))}
              className="min-h-11 shrink-0 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-40"
            >
              Rattacher
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={enCours}
              onClick={() => lancer(() => marquerRecherche(recherche.terme, "a_sourcer"))}
              className="min-h-11 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-40"
            >
              Produit à sourcer
            </button>
            <button
              type="button"
              disabled={enCours}
              onClick={() => lancer(() => marquerRecherche(recherche.terme, "ignore"))}
              className="min-h-11 rounded-full px-4 text-sm font-medium text-ink/45 hover:bg-ink/5 disabled:opacity-40"
            >
              Ignorer
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={enCours}
          onClick={() => lancer(() => reouvrirRecherche(recherche.terme))}
          className="min-h-11 w-fit rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70 hover:bg-ink/5 disabled:opacity-40"
        >
          Remettre à traiter
        </button>
      )}

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </li>
  );
}
