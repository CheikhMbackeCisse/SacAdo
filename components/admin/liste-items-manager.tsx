"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Minus, Plus, X } from "lucide-react";
import {
  ajouterListeItem,
  modifierListeItemCocheDefaut,
  modifierListeItemQuantite,
  retirerListeItem,
  reordonnerListeItems,
  type ListeItemAvecProduitAdmin,
} from "@/lib/admin/listes-actions";
import { rechercherProduitsAdmin } from "@/lib/admin/produits-actions";
import { ListeReordonnable } from "@/components/admin/liste-reordonnable";
import { formatPrice } from "@/lib/format";
import { ProductImage } from "@/components/ui/product-image";
import { ChampSelect, type OptionSelect } from "@/components/ui/champ-select";

const LABELS_STATUT: Record<string, string> = {
  en_attente: "en attente",
  negociation: "en négociation",
  refuse: "refusé",
};

function libelleProduit(p: { nom: string; statut_publication: string }): string {
  const suffixe = LABELS_STATUT[p.statut_publication];
  return suffixe ? `${p.nom} (${suffixe})` : p.nom;
}

const DELAI_RETRAIT_MS = 5000;

export function ListeItemsManager({
  listeId,
  items,
}: {
  listeId: number;
  items: ListeItemAvecProduitAdmin[];
}) {
  const router = useRouter();
  const [produitId, setProduitId] = useState<number | "">("");
  const [produitSelectionne, setProduitSelectionne] = useState<OptionSelect | null>(null);
  const [quantite, setQuantite] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [retraitEnAttente, setRetraitEnAttente] = useState<{ id: number; nom: string } | null>(null);
  const minuteurRetrait = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
  }, []);

  const idsPresents = items.map((item) => item.produit_id);
  const itemsAffiches = items.filter((it) => it.id !== retraitEnAttente?.id);

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
    const result = await ajouterListeItem(listeId, Number(produitId), Number(quantite));
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
    const result = await modifierListeItemQuantite(id, Math.max(1, valeur));
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const changerCocheDefaut = async (id: number, cocheDefaut: boolean) => {
    setError(null);
    const result = await modifierListeItemCocheDefaut(id, cocheDefaut);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const demarrerRetrait = (item: ListeItemAvecProduitAdmin) => {
    if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
    setRetraitEnAttente({ id: item.id, nom: item.produit_nom });
    minuteurRetrait.current = setTimeout(async () => {
      minuteurRetrait.current = null;
      setRetraitEnAttente(null);
      const result = await retirerListeItem(item.id);
      if (!result.ok) setError(result.error);
      router.refresh();
    }, DELAI_RETRAIT_MS);
  };

  const annulerRetrait = () => {
    if (minuteurRetrait.current) clearTimeout(minuteurRetrait.current);
    minuteurRetrait.current = null;
    setRetraitEnAttente(null);
  };

  const reordonner = async (nouveaux: ListeItemAvecProduitAdmin[]) => {
    const result = await reordonnerListeItems(listeId, nouveaux.map((it) => it.id));
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  return (
    <div className="flex max-w-3xl flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5">
      {itemsAffiches.length === 0 ? (
        <p className="text-sm text-ink/50">Aucun article dans cette liste pour l&apos;instant.</p>
      ) : (
        <ListeReordonnable
          items={itemsAffiches}
          idDe={(it) => it.id}
          onReorder={reordonner}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          renderItem={(item) => (
            <div className="flex flex-col gap-1.5 rounded-xl border border-ink/10 p-2 transition-colors">
              <div className="relative aspect-square cursor-grab touch-none overflow-hidden rounded-lg bg-ink/5 active:cursor-grabbing">
                <ProductImage src={item.produit_photo} alt={item.produit_nom} className="h-full w-full" sizes="150px" />
                <span className="absolute left-1 top-1 rounded-full bg-white/90 p-0.5 text-ink/50 shadow">
                  <GripVertical size={12} />
                </span>
                <button
                  type="button"
                  onClick={() => demarrerRetrait(item)}
                  className="absolute right-0 top-0 flex min-h-11 min-w-11 items-center justify-center text-ink lg:min-h-0 lg:min-w-0 lg:p-1"
                  aria-label={`Retirer ${item.produit_nom} de la liste`}
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
                <label className="flex items-center gap-1 text-[11px] text-ink/60">
                  <input
                    type="checkbox"
                    checked={item.coche_defaut}
                    onChange={(e) => changerCocheDefaut(item.id, e.target.checked)}
                    className="size-4 rounded border-ink/25"
                  />
                  Coché
                </label>
              </div>
            </div>
          )}
        />
      )}

      {retraitEnAttente && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-ink/[0.04] px-3 py-2 text-xs text-ink/70">
          <span>« {retraitEnAttente.nom} » retiré de la liste.</span>
          <button type="button" onClick={annulerRetrait} className="font-semibold text-brand hover:underline">
            Annuler
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-ink/10 pt-3 sm:flex-row sm:items-end sm:gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-ink/60">Ajouter un article</span>
          <ChampSelect
            ariaLabel="Article à ajouter à la liste"
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
