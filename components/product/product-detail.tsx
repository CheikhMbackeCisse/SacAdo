"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { FavoriteButton } from "@/components/ui/favorite-button";
import { ShareButton } from "@/components/ui/share-button";
import { GuideTailles } from "@/components/product/guide-tailles";
import { formatPrice } from "@/lib/format";
import { usePanier } from "@/lib/local/panier";
import { useConsultes } from "@/lib/local/consultes";
import { mesurer } from "@/lib/mesure-client";
import type { EditionSoeur } from "@/lib/supabase/queries";
import type { Produit, VarianteAvecAttributs } from "@/lib/supabase/types";

type ProductDetailProps = {
  produit: Produit;
  variantes: VarianteAvecAttributs[];
  categorieNom: string | null;
  // Livres et annales (migration 0068) : éditions soeurs (même ouvrage_id),
  // vide si le produit n'a pas d'édition alternative.
  autresEditions?: EditionSoeur[];
};

export function ProductDetail({
  produit,
  variantes,
  categorieNom,
  autresEditions = [],
}: ProductDetailProps) {
  const { ajouter } = usePanier();
  const { recordConsulte } = useConsultes();
  // Un choix par attribut (attribut_id -> valeur). Pré-rempli s'il n'y a qu'une
  // seule variante.
  const [choix, setChoix] = useState<Record<number, string>>(() => {
    if (variantes.length !== 1) return {};
    const initial: Record<number, string> = {};
    for (const a of variantes[0].attributs) initial[a.attribut_id] = a.valeur;
    return initial;
  });
  const [quantite, setQuantite] = useState(1);
  const [added, setAdded] = useState(false);
  const [slide, setSlide] = useState(0);
  const carrouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    recordConsulte(produit.id);
    mesurer({ type: "vue_produit", produitId: produit.id });
    // On ne veut relancer l'enregistrement que si le produit affiché change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produit.id]);

  // Attributs proposés par ce produit (déduits de ses variantes) + valeurs
  // distinctes de chacun.
  const attributsDuProduit = useMemo(() => {
    const map = new Map<number, { id: number; nom: string; valeurs: string[] }>();
    for (const v of variantes) {
      for (const a of v.attributs) {
        const entree = map.get(a.attribut_id) ?? { id: a.attribut_id, nom: a.nom, valeurs: [] };
        if (!entree.valeurs.includes(a.valeur)) entree.valeurs.push(a.valeur);
        map.set(a.attribut_id, entree);
      }
    }
    return [...map.values()].sort((x, y) => x.nom.localeCompare(y.nom));
  }, [variantes]);

  // Pas d'attribut à choisir (produit sans variante, ou données pas encore
  // migrées vers variante_attributs) → rien ne bloque l'ajout au panier.
  const aDesOptions = attributsDuProduit.length > 0;
  const tousChoisis = aDesOptions && attributsDuProduit.every((a) => choix[a.id]);

  const selectedVariante = !aDesOptions
    ? (variantes.length === 1 ? variantes[0] : null)
    : tousChoisis
      ? (variantes.find((v) =>
          attributsDuProduit.every((a) =>
            v.attributs.some((va) => va.attribut_id === a.id && va.valeur === choix[a.id]),
          ),
        ) ?? null)
      : null;

  // Une valeur est barrée si toutes les variantes qui la portent sont épuisées.
  const valeurEpuisee = (attributId: number, valeur: string) =>
    variantes
      .filter((v) => v.attributs.some((va) => va.attribut_id === attributId && va.valeur === valeur))
      .every((v) => v.statut === "epuise");
  // Galerie : la photo de la variante choisie prime ; sinon la galerie du
  // produit (jusqu'à 4, vendeurs), avec repli sur la photo principale seule.
  // `?? []` : tolère les lignes pas encore migrées (colonne `photos` absente).
  const photosProduit = produit.photos ?? [];
  const galerie: string[] = selectedVariante?.photo
    ? [selectedVariante.photo]
    : photosProduit.length > 0
      ? photosProduit
      : produit.photo
        ? [produit.photo]
        : [];
  const prix = selectedVariante?.prix ?? produit.prix;

  const majSlide = () => {
    const el = carrouselRef.current;
    if (el && el.clientWidth > 0) setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  const varianteEpuisee = selectedVariante?.statut === "epuise";
  const produitEpuise = produit.statut === "epuise";
  const peutAjouter =
    !produitEpuise && !varianteEpuisee && (!aDesOptions || selectedVariante !== null);

  const handleAjouter = () => {
    if (!peutAjouter) return;
    ajouter(produit.id, selectedVariante?.id ?? null, quantite);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        {galerie.length <= 1 ? (
          <div className="relative aspect-square w-full bg-ink/5">
            <ProductImage src={galerie[0] ?? null} alt={produit.nom} className="h-full w-full" />
          </div>
        ) : (
          <>
            <div
              ref={carrouselRef}
              onScroll={majSlide}
              className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {galerie.map((src, index) => (
                <div
                  key={src}
                  className="relative aspect-square w-full shrink-0 snap-center bg-ink/5"
                >
                  <ProductImage
                    src={src}
                    alt={`${produit.nom} — photo ${index + 1}`}
                    className="h-full w-full"
                  />
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {galerie.map((src, index) => (
                <span
                  key={src}
                  className={`h-1.5 rounded-full transition-all ${
                    index === slide ? "w-4 bg-brand" : "w-1.5 bg-white/70"
                  }`}
                />
              ))}
            </div>
          </>
        )}
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <FavoriteButton produitId={produit.id} size={20} />
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            {categorieNom && (
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink/40">
                {categorieNom}
              </span>
            )}
            <h1 className="font-heading text-lg font-bold text-ink">{produit.nom}</h1>
            {(produit.auteur || produit.editeur || produit.edition) && (
              <p className="text-xs text-ink/50">
                {[produit.auteur, produit.editeur, produit.edition].filter(Boolean).join(" — ")}
              </p>
            )}
          </div>
          <ShareButton
            path={`/produit/${produit.id}`}
            title={produit.nom}
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink/70 transition-transform active:scale-90"
            size={17}
          />
        </div>

        {produit.edition_statut === "en_vigueur" && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#16A34A]/12 px-2.5 py-1 text-[11px] font-semibold text-[#166534]">
            Édition en vigueur
            {produit.couverture_epreuves && ` — épreuves ${produit.couverture_epreuves}`}
          </span>
        )}
        {produit.edition_statut === "ancienne" && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-ink/8 px-2.5 py-1 text-[11px] font-semibold text-ink/60">
            Ancienne édition
          </span>
        )}

        <span className="text-base font-semibold text-ink">{formatPrice(prix)}</span>

        {produit.edition_statut === "ancienne" && (
          <p className="rounded-lg bg-ink/5 px-3 py-2.5 text-xs leading-relaxed text-ink/60">
            Cette édition est antérieure au programme actuel. La pagination et les
            exercices peuvent différer de ceux demandés en classe.
          </p>
        )}

        {autresEditions.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-ink/10 p-3">
            <span className="text-xs font-semibold text-ink/70">Autres éditions disponibles</span>
            {autresEditions.map((edition) => {
              const ecart = edition.prix - prix;
              return (
                <a
                  key={edition.id}
                  href={`/produit/${edition.id}`}
                  className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-ink/5"
                >
                  <span className="font-medium text-ink">
                    Édition {edition.edition ?? "?"}
                    {edition.couverture_epreuves && `, épreuves ${edition.couverture_epreuves}`}
                  </span>
                  <span className="text-ink/50">
                    {formatPrice(edition.prix)}
                    {ecart !== 0 &&
                      `, soit ${formatPrice(Math.abs(ecart))} de ${ecart > 0 ? "plus" : "moins"}`}
                  </span>
                </a>
              );
            })}
          </div>
        )}

        {attributsDuProduit.map((attribut) => (
          <div key={attribut.id} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink/60">{attribut.nom}</span>
            <div className="flex flex-wrap gap-2">
              {attribut.valeurs.map((valeur) => {
                const epuisee = valeurEpuisee(attribut.id, valeur);
                const active = choix[attribut.id] === valeur;
                return (
                  <button
                    key={valeur}
                    type="button"
                    disabled={epuisee}
                    onClick={() => setChoix((c) => ({ ...c, [attribut.id]: valeur }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      epuisee
                        ? "cursor-not-allowed border-ink/10 text-ink/25 line-through"
                        : active
                          ? "border-brand bg-brand text-on-brand"
                          : "border-ink/15 text-ink/70"
                    }`}
                  >
                    {valeur}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {aDesOptions && !selectedVariante && (
          <span className="text-[11px] text-ink/40">
            Choisis {attributsDuProduit.length > 1 ? "les options" : "une option"} avant d&apos;ajouter
            au panier.
          </span>
        )}

        {produit.guide_tailles && (
          <GuideTailles
            tailles={
              attributsDuProduit.find((a) => a.nom.toLowerCase() === "taille")?.valeurs ?? []
            }
          />
        )}

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
          onClick={handleAjouter}
          className="mt-1 flex h-12 items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
        >
          {produitEpuise || varianteEpuisee
            ? "Épuisé"
            : added
              ? "Ajouté ✓"
              : "Ajouter au panier"}
        </button>

        {produit.description && (
          <section className="mt-1 flex flex-col gap-1.5 border-t border-ink/10 pt-3">
            <h2 className="text-xs font-medium text-ink/60">Description</h2>
            {/* Fiche produit : description complète, jamais tronquée (CORRECTIONS_V10 §2). */}
            <p className="whitespace-pre-line text-xs leading-snug text-ink/70">
              {produit.description}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
