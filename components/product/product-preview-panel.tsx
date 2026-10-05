"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { ProductGallery } from "@/components/product/product-gallery";
import { formatPrice, uniteVenteAffichee } from "@/lib/format";
import { usePanier } from "@/lib/local/panier";
import { useProductPreview } from "@/components/product/product-preview-context";
import { chargerApercuProduit, type ApercuProduit } from "@/lib/product-preview-actions";

const LIBELLE_DELAI: Record<string, string> = {
  "24h": "Livraison express (24h)",
  "6j": "Livraison à date donnée",
};

// Panneau d'aperçu (CORRECTIONS_V16 §2.1, retravaillé) : ancré à droite,
// 440 px, desktop uniquement (`hidden lg:block`). Toujours monté (même
// fermé, translaté hors écran) pour permettre une transition douce ; la
// place qu'il réserve est gérée par <main> (margin-right), pas par ce
// composant. Coquille toujours montée ; le contenu (ApercuContenu) est
// remonté via `key={produitId}` à chaque nouveau produit, donc chaque état
// (choix, quantité…) repart à zéro sans réinitialisation manuelle dans un
// effet (cf. react-hooks/set-state-in-effect).
export function ProductPreviewPanel() {
  const { produitId, fermer } = useProductPreview();
  const ouvert = produitId !== null;

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu du produit"
      aria-hidden={!ouvert}
      // 440px : garder en phase avec le "lg:mr-[440px]" de app-main.tsx, qui
      // réserve la même largeur dans le contenu de la page. top-[108px] :
      // hauteur du header (barre de recherche h-16 = 64px + rangée de nav
      // desktop ~44px) — le panneau commence juste sous, jamais par-dessus.
      className={`fixed right-0 top-[108px] bottom-0 z-50 hidden w-[440px] flex-col border-l border-ink/10 bg-surface shadow-2xl transition-transform duration-200 lg:flex ${
        ouvert ? "translate-x-0" : "pointer-events-none translate-x-full"
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-ink/10 px-4 py-3">
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
      {produitId !== null && <ApercuContenu key={produitId} produitId={produitId} />}
    </aside>
  );
}

function ApercuContenu({ produitId }: { produitId: number }) {
  const { ajouter } = usePanier();
  const [apercu, setApercu] = useState<ApercuProduit | null>(null);
  const [choix, setChoix] = useState<Record<number, string>>({});
  const [quantite, setQuantite] = useState(1);
  const [added, setAdded] = useState(false);
  const [veutPersonnaliser, setVeutPersonnaliser] = useState(false);
  const [nomPerso, setNomPerso] = useState("");
  const [specialitePerso, setSpecialitePerso] = useState("");
  const PERSO_MAX = 30;

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

  // Caractéristiques techniques (ordinateurs reconditionnés) : même logique
  // que la fiche complète (components/product/product-detail.tsx).
  const caracteristiques = useMemo(() => {
    if (!produit) return [];
    const lignes: [string, string][] = [];
    if (produit.processeur) lignes.push(["Processeur", produit.processeur]);
    if (produit.ram_go) lignes.push(["RAM", `${produit.ram_go} Go`]);
    if (produit.stockage_go) {
      lignes.push([
        "Stockage",
        produit.type_stockage ? `${produit.type_stockage} ${produit.stockage_go} Go` : `${produit.stockage_go} Go`,
      ]);
    }
    if (produit.taille_ecran) lignes.push(["Écran", `${produit.taille_ecran} pouces`]);
    if (produit.ecran_tactile != null) lignes.push(["Tactile", produit.ecran_tactile ? "Oui" : "Non"]);
    if (produit.convertible) lignes.push(["Convertible", "Oui"]);
    return lignes;
  }, [produit]);

  if (!apercu || !produit) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-ink/40">Chargement…</span>
      </div>
    );
  }

  const prixPersonnalisation = produit.personnalisable ? (produit.prix_personnalisation ?? 0) : 0;
  const personnalisationValide =
    veutPersonnaliser && nomPerso.trim().length > 0 && specialitePerso.trim().length > 0;
  const prix =
    (selectedVariante?.prix ?? produit.prix) + (personnalisationValide ? prixPersonnalisation : 0);
  const galerie = selectedVariante?.photo
    ? [selectedVariante.photo]
    : produit.photos?.length
      ? produit.photos
      : produit.photo
        ? [produit.photo]
        : [];
  const varianteEpuisee = selectedVariante?.statut === "epuise";
  const produitEpuise = produit.statut === "epuise";
  const peutAjouter =
    !produitEpuise &&
    !varianteEpuisee &&
    (!aDesOptions || selectedVariante !== null) &&
    (!veutPersonnaliser || personnalisationValide);

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <ProductGallery photos={galerie} alt={produit.nom} thumbSizeClassName="w-12" />

        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-base font-bold text-ink">{produit.nom}</h2>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-ink">
              {formatPrice(prix)}
              {uniteVenteAffichee(produit.unite_vente, produit.quantite_conditionnement) && (
                <span className="ml-1 text-xs font-normal text-ink/50">
                  {uniteVenteAffichee(produit.unite_vente, produit.quantite_conditionnement)}
                </span>
              )}
            </span>
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

        {produit.personnalisable && (
          <div className="flex flex-col gap-2 rounded-lg border border-ink/10 p-3">
            <label className="flex items-center gap-2 text-xs font-medium text-ink">
              <input
                type="checkbox"
                checked={veutPersonnaliser}
                onChange={(e) => setVeutPersonnaliser(e.target.checked)}
                className="size-4 accent-brand"
              />
              Personnaliser (+{formatPrice(prixPersonnalisation)})
            </label>
            {veutPersonnaliser && (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={nomPerso}
                  onChange={(e) => setNomPerso(e.target.value.slice(0, PERSO_MAX))}
                  placeholder="Nom à broder"
                  maxLength={PERSO_MAX}
                  className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink placeholder:text-ink/40"
                />
                <input
                  type="text"
                  value={specialitePerso}
                  onChange={(e) => setSpecialitePerso(e.target.value.slice(0, PERSO_MAX))}
                  placeholder="Spécialité à broder"
                  maxLength={PERSO_MAX}
                  className="rounded-lg border border-ink/15 px-3 py-2 text-sm text-ink placeholder:text-ink/40"
                />
              </div>
            )}
          </div>
        )}

        {caracteristiques.length > 0 && (
          <section className="flex flex-col gap-1.5 border-t border-ink/10 pt-3">
            <h3 className="text-xs font-medium text-ink/60">Caractéristiques techniques</h3>
            <dl className="flex flex-col gap-1 text-xs">
              {caracteristiques.map(([label, valeur]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-ink/50">{label}</dt>
                  <dd className="text-right font-medium text-ink">{valeur}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {produit.description && (
          <section className="flex flex-col gap-1.5 border-t border-ink/10 pt-3">
            <h3 className="text-xs font-medium text-ink/60">Description</h3>
            <p className="whitespace-pre-line text-xs leading-snug text-ink/70">{produit.description}</p>
          </section>
        )}
      </div>

      {/* Barre d'action : toujours visible, jamais coupée, quelle que soit la
          hauteur de l'écran — seul le bloc ci-dessus défile. */}
      <div className="flex shrink-0 flex-col gap-3 border-t border-ink/10 bg-surface p-4">
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
            ajouter(
              produit.id,
              selectedVariante?.id ?? null,
              quantite,
              personnalisationValide
                ? { nom: nomPerso.trim().slice(0, PERSO_MAX), specialite: specialitePerso.trim().slice(0, PERSO_MAX) }
                : null,
            );
            setAdded(true);
            setTimeout(() => setAdded(false), 1500);
          }}
          className="flex h-12 items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action transition-transform active:scale-95 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/30"
        >
          {produitEpuise || varianteEpuisee ? "Épuisé" : added ? "Ajouté ✓" : "Ajouter au panier"}
        </button>
      </div>
    </>
  );
}
