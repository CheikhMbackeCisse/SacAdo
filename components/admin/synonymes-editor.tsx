"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, X } from "lucide-react";
import {
  ajouterTermeSynonyme,
  creerGroupeSynonymes,
  supprimerTermeSynonyme,
  type GroupeSynonymes,
} from "@/lib/admin/synonymes-actions";
import { normaliserTerme } from "@/lib/recherche/normaliser";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

export function SynonymesEditor({ groupes }: { groupes: GroupeSynonymes[] }) {
  const [filtre, setFiltre] = useState("");
  const [creation, setCreation] = useState(false);

  const filtres = useMemo(() => {
    const q = normaliserTerme(filtre);
    if (q.length < 2) return groupes;
    return groupes.filter((g) => g.termes.some((t) => t.terme.includes(q)));
  }, [groupes, filtre]);

  const nbTermes = groupes.reduce((total, g) => total + g.termes.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="relative flex-1 basis-56">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35"
          />
          <input
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="Chercher un terme…"
            aria-label="Chercher un terme"
            className={`${CHAMP} w-full pl-9`}
          />
        </span>
        {!creation && (
          <button
            type="button"
            onClick={() => setCreation(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95"
          >
            <Plus size={16} aria-hidden="true" />
            Nouveau groupe
          </button>
        )}
      </div>

      {creation && <FormGroupe onFini={() => setCreation(false)} />}

      <p className="text-xs text-ink/45">
        {groupes.length} groupe{groupes.length > 1 ? "s" : ""}, {nbTermes} terme
        {nbTermes > 1 ? "s" : ""}
        {filtres.length !== groupes.length && ` — ${filtres.length} affiché(s)`}
      </p>

      {filtres.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun groupe ne contient ce terme. Crée un nouveau groupe pour l&apos;ajouter.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {filtres.map((g) => (
            <CarteGroupe key={g.groupe} groupe={g} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CarteGroupe({ groupe }: { groupe: GroupeSynonymes }) {
  const router = useRouter();
  const [ajout, setAjout] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const ajouter = async () => {
    if (!ajout.trim()) return;
    setEnCours(true);
    setErreur(null);
    const res = await ajouterTermeSynonyme(groupe.groupe, ajout);
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setAjout("");
    router.refresh();
  };

  const retirer = async (id: number) => {
    setErreur(null);
    const res = await supprimerTermeSynonyme(id);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    router.refresh();
  };

  return (
    <li className="flex flex-col gap-2.5 rounded-2xl border border-ink/10 bg-white p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-ink/35">#{groupe.groupe}</span>
        {groupe.termes.map((t) => (
          <span
            key={t.id}
            className="flex items-center gap-1 rounded-full bg-ink/5 py-1 pl-2.5 pr-1 text-xs text-ink"
          >
            {t.terme}
            <button
              type="button"
              onClick={() => retirer(t.id)}
              aria-label={`Retirer ${t.terme}`}
              className="rounded-full p-0.5 text-ink/40 hover:bg-red-50 hover:text-red-600"
            >
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={ajout}
          onChange={(e) => setAjout(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void ajouter();
            }
          }}
          placeholder="Ajouter un terme équivalent"
          aria-label={`Ajouter un terme au groupe ${groupe.groupe}`}
          className="min-w-0 flex-1 rounded-lg border border-ink/15 px-2 py-1.5 text-xs focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={ajouter}
          disabled={enCours || !ajout.trim()}
          className="rounded-full border border-brand/40 px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand/5 disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </li>
  );
}

function FormGroupe({ onFini }: { onFini: () => void }) {
  const router = useRouter();
  const [termes, setTermes] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const creer = async () => {
    setEnCours(true);
    setErreur(null);
    const res = await creerGroupeSynonymes(termes);
    if (!res.ok) {
      setErreur(res.error);
      setEnCours(false);
      return;
    }
    router.refresh();
    onFini();
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Nouveau groupe de synonymes</p>
        <p className="mt-1 text-xs text-ink/55">
          Des termes qui désignent la même chose, séparés par des virgules. Dans un groupe, ils
          sont interchangeables dans les deux sens.
        </p>
      </div>

      <textarea
        value={termes}
        onChange={(e) => setTermes(e.target.value)}
        rows={2}
        placeholder="ex : gourde, bouteille, bouteille d'eau"
        aria-label="Termes du groupe"
        className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
      />

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={creer}
          disabled={enCours || !termes.trim()}
          className="min-h-11 flex-1 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50 sm:flex-none"
        >
          {enCours ? "Création…" : "Créer le groupe"}
        </button>
        <button
          type="button"
          onClick={onFini}
          className="min-h-11 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
