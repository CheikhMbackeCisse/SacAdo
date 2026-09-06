"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wallet } from "lucide-react";
import {
  CATEGORIES_DEPENSE,
  creerDepense,
  reverserVendeur,
  supprimerDepense,
  type DepenseInput,
  type Periode,
  type RecapComptabilite,
} from "@/lib/admin/comptabilite-actions";
import { formatPrice } from "@/lib/format";
import type { CategorieDepense, Depense } from "@/lib/supabase/types";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

const PERIODES: { valeur: Periode; label: string }[] = [
  { valeur: "jour", label: "Jour" },
  { valeur: "semaine", label: "Semaine" },
  { valeur: "mois", label: "Mois" },
];

const LABEL_CATEGORIE: Record<CategorieDepense, string> = Object.fromEntries(
  CATEGORIES_DEPENSE.map((c) => [c.valeur, c.label]),
) as Record<CategorieDepense, string>;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function ComptabiliteEditor({ recap, depenses }: { recap: RecapComptabilite; depenses: Depense[] }) {
  return (
    <div className="flex flex-col gap-5">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-brand/20 bg-brand/5 p-4">
          <p className="text-xs font-medium text-ink/60">Solde réel (trésorerie)</p>
          <p className="mt-1 font-heading text-2xl font-bold text-ink">{formatPrice(recap.soldeReel)}</p>
          <p className="mt-1 text-xs text-ink/50">Argent réellement disponible, à l&apos;instant T.</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-xs font-medium text-ink/60">Solde comptable</p>
          <p className="mt-1 font-heading text-2xl font-bold text-ink">{formatPrice(recap.soldeComptable)}</p>
          <p className="mt-1 text-xs text-ink/50">
            Solde réel + créances ({formatPrice(recap.creancesEnCours)}) − dettes vendeurs (
            {formatPrice(recap.dettesVendeursTotal)}).
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-ink/10 bg-white p-1 sm:w-fit">
          {PERIODES.map((p) => (
            <Link
              key={p.valeur}
              href={`/admin/comptabilite?periode=${p.valeur}`}
              className={`flex min-h-9 flex-1 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors sm:flex-none ${
                recap.periode === p.valeur ? "bg-brand text-on-brand" : "text-ink/60 hover:bg-ink/5"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-ink/10 bg-white p-4">
            <p className="text-xs font-medium text-ink/60">Entrées ({recap.periode})</p>
            <p className="mt-1 text-lg font-semibold text-ink">{formatPrice(recap.totalEntreesPeriode)}</p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-white p-4">
            <p className="text-xs font-medium text-ink/60">Dépenses ({recap.periode})</p>
            <p className="mt-1 text-lg font-semibold text-ink">{formatPrice(recap.totalDepensesPeriode)}</p>
          </div>
        </div>
      </section>

      <DettesVendeurs dettes={recap.dettesVendeurs} />
      <DepensesSection depenses={depenses} />
    </div>
  );
}

function DettesVendeurs({ dettes }: { dettes: RecapComptabilite["dettesVendeurs"] }) {
  if (dettes.length === 0) return null;

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-sm font-semibold text-ink">Montants à reverser aux vendeurs</h2>
      <ul className="flex flex-col gap-2">
        {dettes.map((d) => (
          <DetteVendeurItem key={d.vendeurId} dette={d} />
        ))}
      </ul>
    </section>
  );
}

function DetteVendeurItem({ dette }: { dette: RecapComptabilite["dettesVendeurs"][number] }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const marquerReverse = async () => {
    setEnCours(true);
    await reverserVendeur(dette.vendeurId);
    router.refresh();
  };

  return (
    <li className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-white p-3.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{dette.nomBoutique}</p>
          {dette.infosReversement && <p className="text-xs text-ink/50">{dette.infosReversement}</p>}
        </div>
        <p className="shrink-0 font-semibold text-ink">{formatPrice(dette.montant)}</p>
      </div>
      {confirme ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-ink/60">Confirmer le reversement de {formatPrice(dette.montant)} ?</span>
          <button
            type="button"
            onClick={marquerReverse}
            disabled={enCours}
            className="rounded-lg bg-brand px-2 py-1 font-medium text-on-brand disabled:opacity-50"
          >
            Confirmer
          </button>
          <button type="button" onClick={() => setConfirme(false)} className="text-ink/50">
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirme(true)}
          className="self-start rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 active:scale-95"
        >
          Marquer comme reversé
        </button>
      )}
    </li>
  );
}

function DepensesSection({ depenses }: { depenses: Depense[] }) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Dépenses</h2>
        {!ouvert && (
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="flex min-h-9 items-center gap-1.5 rounded-full bg-brand px-3.5 text-xs font-semibold text-on-brand active:scale-95"
          >
            <Plus size={14} aria-hidden="true" />
            Ajouter
          </button>
        )}
      </div>

      {ouvert && <FormDepense onFini={() => setOuvert(false)} />}

      {depenses.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucune dépense enregistrée.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {depenses.map((d) => (
            <li
              key={d.id}
              className="flex items-start justify-between gap-2 rounded-2xl border border-ink/10 bg-white p-3.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink">{LABEL_CATEGORIE[d.categorie]}</p>
                <p className="text-xs text-ink/50">
                  {formatDate(d.date)}
                  {d.note ? ` · ${d.note}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-ink">{formatPrice(d.montant)}</span>
                <SupprimerDepenseBouton depense={d} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FormDepense({ onFini }: { onFini: () => void }) {
  const router = useRouter();
  const [categorie, setCategorie] = useState<CategorieDepense>("divers");
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enregistrer = async () => {
    setSubmitting(true);
    setError(null);
    const input: DepenseInput = {
      categorie,
      montant: Number(montant),
      date,
      note: note.trim() || null,
    };
    const res = await creerDepense(input);
    if (!res.ok) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    router.refresh();
    onFini();
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-white p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Wallet size={16} aria-hidden="true" />
        Nouvelle dépense
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Catégorie</span>
        <select
          value={categorie}
          onChange={(e) => setCategorie(e.target.value as CategorieDepense)}
          className={CHAMP}
        >
          {CATEGORIES_DEPENSE.map((c) => (
            <option key={c.valeur} value={c.valeur}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Montant (FCFA)</span>
          <input
            type="number"
            min={1}
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={CHAMP} />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Note <span className="text-ink/40">(facultatif)</span>
        </span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={CHAMP} />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={submitting || !montant || Number(montant) <= 0}
          className="min-h-11 flex-1 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50 sm:flex-none"
        >
          {submitting ? "Enregistrement…" : "Enregistrer"}
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

function SupprimerDepenseBouton({ depense }: { depense: Depense }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const supprimer = async () => {
    setEnCours(true);
    await supprimerDepense(depense.id);
    router.refresh();
  };

  if (confirme) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={supprimer}
          disabled={enCours}
          className="rounded-lg bg-red-600 px-2 py-1 font-medium text-white disabled:opacity-50"
        >
          Supprimer
        </button>
        <button type="button" onClick={() => setConfirme(false)} className="text-ink/50">
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirme(true)}
      aria-label="Supprimer la dépense"
      className="rounded-lg p-1.5 text-ink/50 hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}
