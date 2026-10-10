"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { slugAvecId } from "@/lib/slug";
import { usePanier } from "@/lib/local/panier";
import { useAjoutMode } from "@/lib/local/ajout-mode";
import { ligneEstAffichable } from "@/lib/kits";
import type { Produit, VarianteAvecAttributs } from "@/lib/supabase/types";

export type LigneListeBuilder = {
  id: number;
  produit: Produit;
  quantiteDefaut: number;
  cocheDefaut: boolean;
  ordre: number;
  variantes: VarianteAvecAttributs[];
};

type EtatLigne = { checked: boolean; varianteId: number | null; quantite: number };

type ListeBuilderProps = {
  listeId: number;
  code: string;
  titre: string;
  lignes: LigneListeBuilder[];
};

function varianteParDefaut(variantes: VarianteAvecAttributs[]): number | null {
  const dispo = variantes.find((v) => v.statut !== "epuise");
  return dispo?.id ?? variantes[0]?.id ?? null;
}

export function ListeBuilder({ listeId, code, titre, lignes: toutesLesLignes }: ListeBuilderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Réouvert depuis « Modifier » sur une carte du panier : on repart de la
  // sélection exacte de ce groupe, quantités comprises (contrairement aux
  // kits, où la quantité est figée et donc jamais restaurée).
  const modifierGroupeId = searchParams.get("modifier");

  const { ajouterListe, lignes: lignesPanier } = usePanier();
  const { mode: modeAjout } = useAjoutMode();
  const [added, setAdded] = useState(false);

  const lignesExistantesDuGroupe = useMemo(
    () => (modifierGroupeId ? lignesPanier.filter((l) => l.groupe?.id === modifierGroupeId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const groupeExistant = lignesExistantesDuGroupe[0]?.groupe ?? null;
  const photoExistante = groupeExistant?.photo ?? null;

  const lignes = useMemo(
    () => toutesLesLignes.filter((l) => ligneEstAffichable(l.produit)).sort((a, b) => a.ordre - b.ordre),
    [toutesLesLignes],
  );

  const [etats, setEtats] = useState<Record<number, EtatLigne>>(() =>
    Object.fromEntries(
      lignes.map((l) => {
        if (lignesExistantesDuGroupe.length > 0) {
          const existante = lignesExistantesDuGroupe.find((le) => le.produitId === l.produit.id);
          return [
            l.id,
            {
              checked: Boolean(existante),
              varianteId: existante?.varianteId ?? varianteParDefaut(l.variantes),
              quantite: existante?.quantite ?? l.quantiteDefaut,
            },
          ];
        }
        return [l.id, { checked: l.cocheDefaut, varianteId: varianteParDefaut(l.variantes), quantite: l.quantiteDefaut }];
      }),
    ),
  );

  const toggle = (id: number) => setEtats((c) => ({ ...c, [id]: { ...c[id], checked: !c[id].checked } }));

  const choisirVariante = (id: number, varianteId: number) =>
    setEtats((c) => ({ ...c, [id]: { ...c[id], varianteId } }));

  const changerQuantite = (id: number, delta: number) =>
    setEtats((c) => ({ ...c, [id]: { ...c[id], quantite: Math.max(1, c[id].quantite + delta) } }));

  const prixLigne = (l: LigneListeBuilder) => {
    const variante = l.variantes.find((v) => v.id === etats[l.id]?.varianteId);
    return variante?.prix ?? l.produit.prix;
  };

  const { total, nbArticles } = useMemo(() => {
    return lignes.reduce(
      (acc, l) => {
        const etat = etats[l.id];
        if (!etat?.checked) return acc;
        return { total: acc.total + etat.quantite * prixLigne(l), nbArticles: acc.nbArticles + etat.quantite };
      },
      { total: 0, nbArticles: 0 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lignes, etats]);

  const ajouterAuPanier = () => {
    const items: { produitId: number; varianteId: number | null; quantite: number }[] = [];
    lignes.forEach((l) => {
      const etat = etats[l.id];
      if (!etat?.checked) return;
      items.push({ produitId: l.produit.id, varianteId: etat.varianteId, quantite: etat.quantite });
    });

    ajouterListe(
      { id: groupeExistant?.id, listeId, code, titre, photo: photoExistante },
      items,
    );
  };

  const handleCommander = () => {
    ajouterAuPanier();
    router.push(modifierGroupeId ? "/panier" : "/checkout");
  };

  const handleAjouterContinuer = () => {
    ajouterAuPanier();
    if (modifierGroupeId) {
      router.push("/panier");
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="flex flex-col lg:mx-auto lg:w-full lg:max-w-5xl lg:flex-row lg:items-start lg:gap-8">
      <div className="flex flex-1 flex-col">
        <ul className="flex flex-col divide-y divide-ink/10 px-4">
          {lignes.map((l) => (
            <LigneListeRow
              key={l.id}
              ligne={l}
              etat={etats[l.id]}
              onToggle={() => toggle(l.id)}
              onVariante={(vid) => choisirVariante(l.id, vid)}
              onQuantite={(delta) => changerQuantite(l.id, delta)}
            />
          ))}
        </ul>
      </div>

      <div className="sticky bottom-16 z-30 mt-4 border-t border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:sticky lg:top-20 lg:mt-0 lg:w-80 lg:shrink-0 lg:rounded-2xl lg:border lg:bg-elevated lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 lg:flex-col lg:items-stretch lg:gap-2">
          <div className="flex flex-col">
            <span className="text-xs text-ink/50">
              {nbArticles} article{nbArticles > 1 ? "s" : ""} sélectionné{nbArticles > 1 ? "s" : ""}
            </span>
            <span className="text-sm font-semibold text-ink">{formatPrice(total)}</span>
          </div>
          {modifierGroupeId || modeAjout ? (
            <button
              type="button"
              disabled={nbArticles === 0}
              onClick={handleAjouterContinuer}
              className="flex h-11 items-center justify-center rounded-full bg-action px-5 text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30 lg:w-full"
            >
              {modifierGroupeId ? "Mettre à jour la liste" : added ? "Ajouté ✓" : "Ajouter la sélection"}
            </button>
          ) : (
            <div className="flex flex-col items-end gap-1.5 lg:items-stretch">
              <button
                type="button"
                disabled={nbArticles === 0}
                onClick={handleCommander}
                className="flex h-11 items-center justify-center rounded-full bg-action px-5 text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30 lg:w-full"
              >
                Commander cette liste
              </button>
              <button
                type="button"
                disabled={nbArticles === 0}
                onClick={handleAjouterContinuer}
                className="text-xs font-medium text-ink/60 underline-offset-2 transition-colors hover:text-ink hover:underline disabled:cursor-not-allowed disabled:text-ink/30 lg:text-center"
              >
                {added ? "Ajouté ✓" : "Ajouter au panier et continuer mes achats"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LigneListeRow({
  ligne,
  etat,
  onToggle,
  onVariante,
  onQuantite,
}: {
  ligne: LigneListeBuilder;
  etat: EtatLigne | undefined;
  onToggle: () => void;
  onVariante: (varianteId: number) => void;
  onQuantite: (delta: number) => void;
}) {
  const epuise = ligne.produit.statut === "epuise";
  const variante = ligne.variantes.find((v) => v.id === etat?.varianteId);
  const prix = variante?.prix ?? ligne.produit.prix;

  return (
    <li className="flex flex-col gap-1.5 py-2.5">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={etat?.checked ?? false}
          disabled={epuise}
          onChange={onToggle}
          aria-label={`Inclure ${ligne.produit.nom}`}
          className="size-5 shrink-0 accent-brand"
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            href={`/produits/${slugAvecId(ligne.produit.nom, ligne.produit.id)}`}
            className="truncate text-sm text-ink hover:underline"
          >
            {ligne.produit.nom}
          </Link>
          <span className="text-xs text-ink/50">{formatPrice(prix)}</span>
          {epuise && <span className="text-[11px] text-ink/40">Épuisé — non inclus</span>}
        </div>

        {!epuise && etat?.checked && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onQuantite(-1)}
              className="flex min-h-9 min-w-9 items-center justify-center text-ink/60"
              aria-label="Diminuer la quantité"
            >
              <span className="rounded-full border border-ink/15 p-1">
                <Minus size={12} />
              </span>
            </button>
            <span className="w-5 text-center text-sm text-ink">{etat.quantite}</span>
            <button
              type="button"
              onClick={() => onQuantite(1)}
              className="flex min-h-9 min-w-9 items-center justify-center text-ink/60"
              aria-label="Augmenter la quantité"
            >
              <span className="rounded-full border border-ink/15 p-1">
                <Plus size={12} />
              </span>
            </button>
          </div>
        )}
      </div>

      {ligne.variantes.length > 1 && etat?.checked && (
        <div className="ml-8 flex flex-wrap gap-1.5">
          {ligne.variantes.map((v) => {
            const label = v.attributs.map((a) => a.valeur).join(" / ") || `#${v.id}`;
            const active = v.id === etat.varianteId;
            const varianteEpuisee = v.statut === "epuise";
            return (
              <button
                key={v.id}
                type="button"
                disabled={varianteEpuisee}
                onClick={() => onVariante(v.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  varianteEpuisee
                    ? "cursor-not-allowed border-ink/10 text-ink/25 line-through"
                    : active
                      ? "border-brand bg-brand text-on-brand"
                      : "border-ink/15 text-ink/70"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
