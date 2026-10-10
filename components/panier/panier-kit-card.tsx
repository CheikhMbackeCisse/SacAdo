"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { formatPrice } from "@/lib/format";
import { estGroupeListe, type GroupePanier } from "@/lib/local/panier";
import type { LigneDetaillee } from "@/lib/local/use-panier-detaille";

type PanierKitCardProps = {
  groupe: GroupePanier;
  lignes: LigneDetaillee[];
  onRetirer: () => void;
};

export function PanierKitCard({ groupe, lignes, onRetirer }: PanierKitCardProps) {
  const [ouvert, setOuvert] = useState(false);

  const nbArticles = lignes.reduce((sum, l) => sum + l.quantite, 0);
  const total = lignes.reduce((sum, l) => sum + l.totalLigne, 0);
  const nbIndisponibles = lignes.filter((l) => l.produit.statut === "epuise").length;

  const estListe = estGroupeListe(groupe);
  const titre = estListe
    ? groupe.titre
    : groupe.beneficiairePrenom
      ? `Kit ${groupe.niveau} · ${groupe.gammeLabel}, pour ${groupe.beneficiairePrenom}`
      : `Votre kit ${groupe.niveau} · ${groupe.gammeLabel}`;
  const lienModifier = estListe
    ? `/liste/${groupe.code}?modifier=${groupe.id}`
    : `/kits/${groupe.cycle}/${encodeURIComponent(groupe.niveau)}/${groupe.gamme}?modifier=${groupe.id}`;
  const vignetteTexte = estListe ? "Liste" : groupe.niveau;

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-ink/10 bg-elevated p-3">
      <div className="flex items-start gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-brand/10">
          {groupe.photo ? (
            <ProductImage src={groupe.photo} alt="" className="h-full w-full" sizes="64px" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-center text-[10px] font-semibold text-brand">
              {vignetteTexte}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-ink">{titre}</span>
          <span className="text-xs text-ink/50">
            {nbArticles} article{nbArticles > 1 ? "s" : ""}
          </span>
          <span className="text-sm font-semibold text-ink/80">{formatPrice(total)}</span>
          {nbIndisponibles > 0 && (
            <span className="mt-0.5 w-fit rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium text-ink/60">
              {nbIndisponibles} article{nbIndisponibles > 1 ? "s" : ""} indisponible
              {nbIndisponibles > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-medium">
        <button
          type="button"
          onClick={() => setOuvert((v) => !v)}
          className="flex items-center gap-1 text-ink/70"
        >
          Voir le contenu
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={`transition-transform ${ouvert ? "rotate-180" : ""}`}
          />
        </button>
        <Link href={lienModifier} className="text-brand">
          Modifier
        </Link>
        <button type="button" onClick={onRetirer} className="text-ink/50">
          Retirer
        </button>
      </div>

      {ouvert && (
        <ul className="flex flex-col divide-y divide-ink/5 border-t border-ink/10 pt-2">
          {lignes.map((l) => (
            <li
              key={`${l.produit.id}-${l.variante?.id ?? "base"}`}
              className="flex items-center justify-between gap-3 py-1.5 text-xs"
            >
              <span className="min-w-0 flex-1 truncate text-ink/70">
                {l.quantite} × {l.produit.nom}
                {l.produit.statut === "epuise" && (
                  <span className="ml-1.5 text-ink/40">— indisponible</span>
                )}
              </span>
              <span className="shrink-0 text-ink/60">{formatPrice(l.totalLigne)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
