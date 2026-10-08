"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, GripVertical, Minus, Plus, Settings2, X } from "lucide-react";
import {
  ajouterKitItem,
  modifierKitItem,
  modifierKitItemQuantite,
  remplacerKitItemProduit,
  retirerKitItem,
  deplacerKitItem,
  reordonnerKitItems,
  type KitItemAvecProduit,
} from "@/lib/admin/kits-actions";
import { rechercherProduitsAdmin } from "@/lib/admin/produits-actions";
import { ListeReordonnable } from "@/components/admin/liste-reordonnable";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/ui/product-image";
import { ChampSelect, type OptionSelect } from "@/components/ui/champ-select";

// Statut affiché à côté du nom pour un produit en attente/masqué/refusé —
// un produit publié n'affiche rien (bruit inutile, cas normal).
const LABELS_STATUT: Record<string, string> = {
  en_attente: "en attente",
  negociation: "en négociation",
  refuse: "refusé",
};

function libelleProduit(p: { nom: string; statut_publication: string }): string {
  const suffixe = LABELS_STATUT[p.statut_publication];
  return suffixe ? `${p.nom} (${suffixe})` : p.nom;
}

const SECTIONS: { value: KitItemAvecProduit["section"]; label: string }[] = [
  { value: "principal", label: "Principal" },
  { value: "livres_proposes", label: "Livres proposés" },
  { value: "option", label: "Option" },
];

const DELAI_RETRAIT_MS = 5000;

export function KitItemsManager({
  kitId,
  items,
}: {
  kitId: number;
  items: KitItemAvecProduit[];
}) {
  const router = useRouter();
  // Aucun produit pré-sélectionné : choix explicite (sinon on ajoute le premier
  // produit de la liste sans le vouloir).
  const [produitId, setProduitId] = useState<number | "">("");
  const [produitSelectionne, setProduitSelectionne] = useState<OptionSelect | null>(null);
  const [quantite, setQuantite] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [detailsOuverts, setDetailsOuverts] = useState<number | null>(null);
  const [retraitEnAttente, setRetraitEnAttente] = useState<{ id: number; nom: string } | null>(null);
  const minuteurRetrait = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
  }, []);

  const idsPresents = items.map((item) => item.produit_id);
  const idsOrdonnes = items.map((i) => i.id);
  const itemsAffiches = items.filter((it) => it.id !== retraitEnAttente?.id);

  // Recherche serveur unique (lib/admin/produits-actions.ts) : plus de liste
  // préchargée, qui coupait silencieusement à 1000 produits sur un catalogue
  // qui en compte plus (cause des produits introuvables au sélecteur).
  const rechercher = async (terme: string): Promise<OptionSelect[]> => {
    const resultats = await rechercherProduitsAdmin(terme, {
      excludeIds: idsPresents,
      exclureAncienneEdition: true,
    });
    return resultats.map((p) => ({ value: String(p.id), label: libelleProduit(p) }));
  };

  const ajouter = async () => {
    setError(null);
    if (!produitId) {
      setError("Veuillez choisir un article à ajouter.");
      return;
    }
    const result = await ajouterKitItem(kitId, Number(produitId), Number(quantite));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setProduitId("");
    setProduitSelectionne(null);
    setQuantite("1");
    router.refresh();
  };

  const changerQuantite = async (id: number, valeur: number) => {
    setError(null);
    const result = await modifierKitItemQuantite(id, Math.max(1, valeur));
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  // × sur la vignette : retrait différé de quelques secondes, annulable
  // (PROMPT_ADMIN_KITS_PRODUITS.md lot 2).
  const demarrerRetrait = (item: KitItemAvecProduit) => {
    if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
    setRetraitEnAttente({ id: item.id, nom: item.produit_nom });
    minuteurRetrait.current = setTimeout(async () => {
      minuteurRetrait.current = null;
      setRetraitEnAttente(null);
      const result = await retirerKitItem(item.id);
      if (!result.ok) setError(result.error);
      router.refresh();
    }, DELAI_RETRAIT_MS);
  };

  const annulerRetrait = () => {
    if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
    minuteurRetrait.current = null;
    setRetraitEnAttente(null);
  };

  const patcher = async (id: number, patch: Parameters<typeof modifierKitItem>[1]) => {
    setError(null);
    const result = await modifierKitItem(id, patch);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const remplacer = async (id: number, nouveauProduitId: number) => {
    setError(null);
    const result = await remplacerKitItemProduit(id, nouveauProduitId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDetailsOuverts(null);
    router.refresh();
  };

  const deplacer = async (id: number, direction: -1 | 1) => {
    setError(null);
    const result = await deplacerKitItem(kitId, idsOrdonnes, id, direction);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  // Glisser-déposer (souris sur ordinateur, appui long + glisser sur
  // téléphone) : reçoit l'ordre final, réécrit `ordre` en une fois.
  const reordonner = async (nouveaux: KitItemAvecProduit[]) => {
    const result = await reordonnerKitItems(kitId, nouveaux.map((it) => it.id));
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  return (
    <div className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5">
      {itemsAffiches.length === 0 ? (
        <p className="text-sm text-ink/50">Aucun article dans ce kit pour l&apos;instant.</p>
      ) : (
        <ListeReordonnable
          items={itemsAffiches}
          idDe={(it) => it.id}
          onReorder={reordonner}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          renderItem={(item) => {
            const index = idsOrdonnes.indexOf(item.id);
            return (
              <div className="flex flex-col gap-1.5 rounded-xl border border-ink/10 p-2 transition-colors">
                <div className="relative aspect-square cursor-grab touch-none overflow-hidden rounded-lg bg-ink/5 active:cursor-grabbing">
                  <ProductImage
                    src={item.produit_photo}
                    alt={item.produit_nom}
                    className="h-full w-full"
                    sizes="150px"
                  />
                  <span className="absolute left-1 top-1 rounded-full bg-white/90 p-0.5 text-ink/50 shadow">
                    <GripVertical size={12} />
                  </span>
                  <button
                    type="button"
                    onClick={() => demarrerRetrait(item)}
                    className="absolute right-0 top-0 flex min-h-11 min-w-11 items-center justify-center text-ink lg:min-h-0 lg:min-w-0 lg:p-1"
                    aria-label={`Retirer ${item.produit_nom} du kit`}
                  >
                    <span className="rounded-full bg-white/90 p-1 shadow">
                      <X size={13} />
                    </span>
                  </button>
                </div>

                <p className="line-clamp-2 text-xs text-ink" title={item.produit_nom}>
                  {item.produit_nom}
                </p>
                <p className="text-[11px] text-ink/40">{formatPrice(item.produit_prix)}</p>

                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => changerQuantite(item.id, item.quantite_defaut - 1)}
                      className="flex min-h-11 min-w-11 items-center justify-center text-ink/60 lg:min-h-0 lg:min-w-0"
                      aria-label="Diminuer la quantité"
                    >
                      <span className="rounded-full border border-ink/15 p-1">
                        <Minus size={12} />
                      </span>
                    </button>
                    <span className="w-5 text-center text-xs">{item.quantite_defaut}</span>
                    <button
                      type="button"
                      onClick={() => changerQuantite(item.id, item.quantite_defaut + 1)}
                      className="flex min-h-11 min-w-11 items-center justify-center text-ink/60 lg:min-h-0 lg:min-w-0"
                      aria-label="Augmenter la quantité"
                    >
                      <span className="rounded-full border border-ink/15 p-1">
                        <Plus size={12} />
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {/* Monter/descendre : repli clavier/souris, caché sur
                        téléphone où le glisser-déposer est l'interaction
                        principale — la rangée n'a pas la place pour 5 cibles
                        de 44 px (PROMPT_ADMIN_KITS_PRODUITS.md lot 6). */}
                    <button
                      type="button"
                      onClick={() => deplacer(item.id, -1)}
                      disabled={index === 0}
                      className="hidden rounded-full border border-ink/15 p-1 text-ink/60 disabled:opacity-30 lg:block"
                      aria-label="Monter"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deplacer(item.id, 1)}
                      disabled={index === idsOrdonnes.length - 1}
                      className="hidden rounded-full border border-ink/15 p-1 text-ink/60 disabled:opacity-30 lg:block"
                      aria-label="Descendre"
                    >
                      <ChevronDown size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailsOuverts(detailsOuverts === item.id ? null : item.id)}
                      className={`flex min-h-11 min-w-11 items-center justify-center lg:min-h-0 lg:min-w-0 ${
                        detailsOuverts === item.id ? "text-brand" : "text-ink/60"
                      }`}
                      aria-label="Réglages de cet article"
                    >
                      <span className={`rounded-full border p-1 ${detailsOuverts === item.id ? "border-brand" : "border-ink/15"}`}>
                        <Settings2 size={12} />
                      </span>
                    </button>
                  </div>
                </div>

                {detailsOuverts === item.id && (
                  <div className="flex flex-col gap-2 border-t border-ink/10 pt-2 text-xs">
                    <ChampSelect
                      ariaLabel="Section"
                      placeholder="Section"
                      className="min-h-9 rounded-lg border border-ink/15 px-2 text-xs"
                      value={item.section}
                      onChange={(v) => patcher(item.id, { section: v as KitItemAvecProduit["section"] })}
                      options={SECTIONS}
                    />
                    <label className="flex items-center gap-1.5 text-ink/60">
                      <input
                        type="checkbox"
                        checked={item.coche_defaut}
                        onChange={(e) => patcher(item.id, { coche_defaut: e.target.checked })}
                        className="size-4 rounded border-ink/25"
                      />
                      Coché par défaut
                    </label>
                    <input
                      defaultValue={item.groupe_affichage ?? ""}
                      onBlur={(e) => patcher(item.id, { groupe_affichage: e.target.value.trim() || null })}
                      placeholder="Groupe"
                      className="min-h-9 rounded-lg border border-ink/15 px-2 text-xs"
                    />
                    <input
                      defaultValue={item.libelle_besoin ?? ""}
                      onBlur={(e) => patcher(item.id, { libelle_besoin: e.target.value.trim() || null })}
                      placeholder="Libellé (ex: 2 cahiers 100p)"
                      className="min-h-9 rounded-lg border border-ink/15 px-2 text-xs"
                    />
                    <ChampSelect
                      ariaLabel="Remplacer par"
                      placeholder="Remplacer par…"
                      searchHint="Tapez le nom, l'ID ou la marque de l'article…"
                      className="min-h-9 rounded-lg border border-ink/15 px-2 text-xs"
                      value=""
                      onChange={(v) => v && remplacer(item.id, Number(v))}
                      options={[]}
                      onSearch={rechercher}
                    />
                  </div>
                )}
              </div>
            );
          }}
        />
      )}

      {retraitEnAttente && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3 py-2 text-xs text-ink/70">
          <span>« {retraitEnAttente.nom} » retiré du kit.</span>
          <button type="button" onClick={annulerRetrait} className="font-semibold text-brand hover:underline">
            Annuler
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-ink/10 pt-3 sm:flex-row sm:items-end sm:gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-ink/60">Ajouter un article</span>
          <ChampSelect
            ariaLabel="Article à ajouter au kit"
            placeholder="Choisir un article…"
            searchHint="Tapez le nom, l'ID ou la marque de l'article…"
            className="min-h-11 rounded-lg border border-ink/15 px-3 text-sm"
            value={produitId === "" ? "" : String(produitId)}
            onChange={(v) => setProduitId(v === "" ? "" : Number(v))}
            options={produitSelectionne ? [produitSelectionne] : []}
            onSelect={(option) => setProduitSelectionne(option)}
            onSearch={rechercher}
          />
        </label>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink/60">Qté</span>
            <input
              type="number"
              min={1}
              value={quantite}
              onChange={(event) => setQuantite(event.target.value)}
              className="min-h-11 w-16 rounded-lg border border-ink/15 px-3 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={ajouter}
            className="min-h-11 flex-1 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 sm:flex-none"
          >
            Ajouter
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
