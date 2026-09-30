"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { formatPrice } from "@/lib/format";
import { slugAvecId } from "@/lib/slug";
import { usePanier } from "@/lib/local/panier";
import { useProductPreview } from "@/components/product/product-preview-context";
import { chargerApercuProduit, type ApercuProduit } from "@/lib/product-preview-actions";

const LIBELLE_DELAI: Record<string, string> = {
  "24h": "Livraison express (24h)",
  "6j": "Livraison à date donnée",
};

// Panneau d'aperçu (CORRECTIONS_V16 §2.1) : fixe à droite, ~440 px, desktop
// uniquement (`hidden lg:flex`, hors-flux via `fixed` — n'affecte jamais la
// mise en page mobile). Superposé à la grille, qui reste visible/cliquable
// à gauche. Coquille toujours montée ; le contenu (ApercuContenu) est
// remonté via `key={produitId}` à chaque nouveau produit, donc chaque état
// (choix, quantité…) repart à zéro sans réinitialisation manuelle dans un
// effet (cf. react-hooks/set-state-in-effect).
export function ProductPreviewPanel() {
  const { produitId, fermer } = useProductPreview();

  if (produitId === null) return null;

  return (
    // Pas de voile plein écran : la grille doit rester cliquable derrière le
    // panneau (cliquer un autre produit remplace l'aperçu, CORRECTIONS_V16
    // §2.1) — seuls Échap et le bouton × ferment.
    <div className="pointer-events-none fixed inset-0 z-50 hidden lg:block" role="dialog" aria-modal="true" aria-label="Aperçu du produit">
      <aside className="pointer-events-auto absolute right-0 top-0 flex h-full w-[440px] flex-col overflow-y-auto border-l border-ink/10 bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink/40">Aperçu rapide</span>
          <button
            type="button"
            aria-label="Fermer"
            onClick={fermer}
            className="flex size-8 items-center justify-center rounded-full text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <ApercuContenu key={produitId} produitId={produitId} fermer={fermer} />
      </aside>
    </div>
  );
}

function ApercuContenu({ produitId, fermer }: { produitId: number; fermer: () => void }) {
  const { ajouter } = usePanier();
  const [apercu, setApercu] = useState<ApercuProduit | null>(null);
  const [choix, setChoix] = useState<Record<number, string>>({});
  const [quantite, setQuantite] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let annule = false;
    chargerApercuProduit(produitId).then((res) => {
      if (!annule) setApercu(res);
    });
    return () => {
      annule = true;
    };
  }, [produitId]);

  const attributsDuProduit = useMemo(() => {
    if (!apercu) return [];
    const map = new Map<number, { id: number; nom: string; valeurs: string[] }>();
    for (const v of apercu.variantes) {
      for (const a of v.attributs) {
        const entree = map.get(a.attribut_id) ?? { id: a.attribut_id, nom: a.nom, valeurs: [] };
        if (!entree.valeurs.includes(a.valeur)) entree.valeurs.push(a.valeur);
        map.set(a.attribut_id, entree);
      }
    }
    return [...map.values()].sort((x, y) => x.nom.localeCompare(y.nom));
  }, [apercu]);

  const aDesOptions = attributsDuProduit.length > 0;
  const tousChoisis = aDesOptions && attributsDuProduit.every((a) => choix[a.id]);
  const selectedVariante =
    !apercu || !aDesOptions
      ? apercu?.variantes.length === 1
        ? apercu.variantes[0]
        : null
      : tousChoisis
        ? (apercu.variantes.find((v) =>
            attributsDuProduit.every((a) =>
              v.attributs.some((va) => va.attribut_id === a.id && va.valeur === choix[a.id]),
            ),
          ) ?? null)
        : null;

  const produit = apercu?.produit;

  if (!apercu || !produit) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-ink/40">Chargement…</span>
      </div>
    );
  }

  const prix = selectedVariante?.prix ?? produit.prix;
  const galerie = selectedVariante?.photo
    ? [selectedVariante.photo]
    : produit.photos?.length
      ? produit.photos
      : produit.photo
        ? [produit.photo]
        : [];
  const varianteEpuisee = selectedVariante?.statut === "epuise";
  const produitEpuise = produit.statut === "epuise";
  const peutAjouter = !produitEpuise && !varianteEpuisee && (!aDesOptions || selectedVariante !== null);
  const href = `/produits/${slugAvecId(produit.nom, produit.id)}`;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-ink/5">
        <ProductImage src={galerie[0] ?? null} alt={produit.nom} className="h-full w-full" fit="contain" sizes="440px" />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-bold text-ink">{produit.nom}</h2>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-ink">{formatPrice(prix)}</span>
          {produitEpuise && (
            <span className="rounded-full bg-ink/8 px-2 py-0.5 text-[11px] font-semibold text-ink/60">
              Épuisé
            </span>
          )}
        </div>
        {produit.delai && (
          <span className="text-xs text-ink/50">{LIBELLE_DELAI[produit.delai] ?? produit.delai}</span>
        )}
      </div>

      {attributsDuProduit.map((attribut) => (
        <div key={attribut.id} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink/60">{attribut.nom}</span>
          <div className="flex flex-wrap gap-2">
            {attribut.valeurs.map((valeur) => {
              const active = choix[attribut.id] === valeur;
              return (
                <button
                  key={valeur}
                  type="button"
                  onClick={() => setChoix((c) => ({ ...c, [attribut.id]: valeur }))}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "border-brand bg-brand text-on-brand" : "border-ink/15 text-ink/70"
                  }`}
                >
                  {valeur}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-ink/60">Quantité</span>
        <div className="flex items-center gap-3 rounded-full border border-ink/15 px-2 py-1">
          <button
            type="button"
            aria-label="Diminuer la quantité"
            onClick={() => setQuantite((q) => Math.max(1, q - 1))}
            className="flex size-6 items-center justify-center rounded-full text-ink/70 active:scale-90"
          >
            <Minus size={14} aria-hidden="true" />
          </button>
          <span className="w-4 text-center text-sm">{quantite}</span>
          <button
            type="button"
            aria-label="Augmenter la quantité"
            onClick={() => setQuantite((q) => q + 1)}
            className="flex size-6 items-center justify-center rounded-full text-ink/70 active:scale-90"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={!peutAjouter}
        onClick={() => {
          if (!peutAjouter) return;
          ajouter(produit.id, selectedVariante?.id ?? null, quantite);
          setAdded(true);
          setTimeout(() => setAdded(false), 1500);
        }}
        className="flex h-12 items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
      >
        {produitEpuise || varianteEpuisee ? "Épuisé" : added ? "Ajouté ✓" : "Ajouter au panier"}
      </button>

      <Link
        href={href}
        onClick={fermer}
        className="mt-auto text-center text-sm font-medium text-brand hover:underline"
      >
        Voir la fiche complète
      </Link>
    </div>
  );
}
