"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/format";
import { PERIODES_BENEFICE, type BeneficePeriode } from "@/lib/admin/comptabilite-constants";
import type { Benefice, LigneBenefice } from "@/lib/admin/comptabilite-actions";

const CHAMP =
  "min-h-10 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR");
}

export function BeneficeSection({
  benefice,
  periodeType,
}: {
  benefice: Benefice;
  periodeType: BeneficePeriode;
}) {
  const router = useRouter();
  const [du, setDu] = useState(benefice.debut);
  const [au, setAu] = useState(benefice.fin);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-ink/10 bg-white p-1">
        {PERIODES_BENEFICE.map((p) => (
          <Link
            key={p.valeur}
            href={`/admin/comptabilite/benefice?bp=${p.valeur}`}
            className={`flex min-h-9 items-center justify-center rounded-lg px-3.5 text-sm font-medium transition-colors ${
              periodeType === p.valeur ? "bg-brand text-on-brand" : "text-ink/60 hover:bg-ink/5"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {periodeType === "perso" && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink/60">
            Du
            <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className={CHAMP} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink/60">
            Au
            <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className={CHAMP} />
          </label>
          <button
            type="button"
            onClick={() =>
              router.push(`/admin/comptabilite/benefice?bp=perso&bd=${du}&bf=${au}`)
            }
            className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand active:scale-95"
          >
            Appliquer
          </button>
        </div>
      )}

      <p className="text-xs text-ink/50">
        Période : du {formatDate(benefice.debut)} au {formatDate(benefice.fin)}.
      </p>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tuile label="Encaissements" valeur={benefice.encaissements} />
        <Tuile label="Coût total" valeur={benefice.coutTotal} />
        <div className="rounded-2xl border-2 border-brand/30 bg-brand/5 p-4">
          <p className="text-xs font-medium text-ink/60">Bénéfice</p>
          <p
            className={`mt-1 font-heading text-3xl font-bold ${
              benefice.benefice < 0 ? "text-red-600" : "text-ink"
            }`}
          >
            {formatPrice(benefice.benefice)}
          </p>
        </div>
      </section>

      <p className="rounded-xl bg-ink/[0.03] px-3 py-2 text-xs text-ink/55">
        Ce montant correspond à l&apos;argent réellement encaissé moins l&apos;argent réellement
        sorti sur la période. Il ne tient pas compte du stock non vendu ni des commandes en
        attente de paiement.
      </p>

      <Repartition
        titre="Reversé aux fournisseurs"
        total={benefice.coutFournisseursTotal}
        lignes={benefice.coutFournisseurs}
        vide="Aucun article vendu avec un prix d'achat renseigné sur la période."
      />
      <Repartition
        titre="Dépenses par catégorie"
        total={benefice.depensesTotal}
        lignes={benefice.depensesParCategorie}
        vide="Aucune dépense sur la période."
      />
    </div>
  );
}

function Tuile({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-xs font-medium text-ink/60">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{formatPrice(valeur)}</p>
    </div>
  );
}

function Repartition({
  titre,
  total,
  lignes,
  vide,
}: {
  titre: string;
  total: number;
  lignes: LigneBenefice[];
  vide: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">{titre}</h2>
        <span className="text-sm font-semibold text-ink">{formatPrice(total)}</span>
      </div>
      {lignes.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-6 text-center text-xs text-ink/50">
          {vide}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white">
          {lignes.map((l) => (
            <li key={l.cle} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="min-w-0 truncate text-ink/80">{l.label}</span>
              <span className="shrink-0 font-medium text-ink">{formatPrice(l.montant)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
