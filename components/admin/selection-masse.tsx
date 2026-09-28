"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { appliquerActionMasse, type ActionMasse } from "@/lib/admin/produits-actions";
import { formatPrice } from "@/lib/format";
import { ChampSelect, type OptionSelect } from "@/components/ui/champ-select";
import type { Categorie, SousCategorie } from "@/lib/supabase/types";

type ProduitLite = { id: number; nom: string; prix: number };

type Ctx = {
  selection: Set<number>;
  basculer: (id: number) => void;
  estSelectionne: (id: number) => boolean;
  toutSelectionner: (ids: number[]) => void;
  produits: Map<number, ProduitLite>;
  categories: Categorie[];
  sousCategories: SousCategorie[];
};

const SelectionContext = createContext<Ctx | null>(null);

function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection hors SelectionMasseProvider");
  return ctx;
}

// Englobe la liste des produits : garde la sélection en mémoire côté client
// pendant que la liste elle-même reste rendue côté serveur (children).
export function SelectionMasseProvider({
  produits,
  categories,
  sousCategories,
  children,
}: {
  produits: ProduitLite[];
  categories: Categorie[];
  sousCategories: SousCategorie[];
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const produitsMap = useMemo(() => new Map(produits.map((p) => [p.id, p])), [produits]);

  const basculer = (id: number) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toutSelectionner = (ids: number[]) => {
    setSelection((current) => {
      const tousDejaLa = ids.every((id) => current.has(id));
      return tousDejaLa ? new Set() : new Set(ids);
    });
  };

  return (
    <SelectionContext.Provider
      value={{
        selection,
        basculer,
        estSelectionne: (id) => selection.has(id),
        toutSelectionner,
        produits: produitsMap,
        categories,
        sousCategories,
      }}
    >
      {children}
      <BarreActionMasse />
    </SelectionContext.Provider>
  );
}

export function CaseSelection({ id }: { id: number }) {
  const { estSelectionne, basculer } = useSelection();
  return (
    <input
      type="checkbox"
      checked={estSelectionne(id)}
      onChange={() => basculer(id)}
      onClick={(e) => e.stopPropagation()}
      className="size-4 rounded border-ink/25"
      aria-label="Sélectionner ce produit"
    />
  );
}

export function CaseToutSelectionner({ ids }: { ids: number[] }) {
  const { selection, toutSelectionner } = useSelection();
  const tousSelectionnes = ids.length > 0 && ids.every((id) => selection.has(id));
  return (
    <input
      type="checkbox"
      checked={tousSelectionnes}
      onChange={() => toutSelectionner(ids)}
      className="size-4 rounded border-ink/25"
      aria-label="Tout sélectionner"
    />
  );
}

const OPTIONS_ACTION: OptionSelect[] = [
  { value: "prix_montant", label: "Prix : ajouter/retirer un montant" },
  { value: "prix_pourcentage", label: "Prix : ajouter/retirer un pourcentage" },
  { value: "publier", label: "Publier" },
  { value: "masquer", label: "Masquer" },
  { value: "categorie", label: "Changer de catégorie" },
];

function BarreActionMasse() {
  const router = useRouter();
  const { selection, produits, toutSelectionner, categories, sousCategories } = useSelection();
  const [action, setAction] = useState("");
  const [valeur, setValeur] = useState("");
  const [categorieId, setCategorieId] = useState("");
  const [sousCategorieId, setSousCategorieId] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selection.size === 0) return null;

  const ids = [...selection];
  const nb = valeur.trim() === "" ? 0 : Number(valeur);

  const sousCatsDeLaCategorie = categories.length
    ? sousCategories.filter((sc) => sc.id !== undefined && String(sc.categorie_id) === categorieId)
    : [];

  const construireAction = (): ActionMasse | null => {
    if (action === "publier") return { type: "publier" };
    if (action === "masquer") return { type: "masquer" };
    if (action === "prix_montant" && Number.isFinite(nb)) return { type: "prix_montant", montant: nb };
    if (action === "prix_pourcentage" && Number.isFinite(nb)) return { type: "prix_pourcentage", pourcentage: nb };
    if (action === "categorie" && categorieId) {
      return {
        type: "categorie",
        categorieId: Number(categorieId),
        sousCategorieId: sousCategorieId ? Number(sousCategorieId) : null,
      };
    }
    return null;
  };

  const apercu = () => {
    if (action === "prix_montant" || action === "prix_pourcentage") {
      const exemple = ids
        .map((id) => produits.get(id))
        .find((p) => p);
      if (!exemple) return "";
      const nouveau =
        action === "prix_montant"
          ? Math.max(0, exemple.prix + nb)
          : Math.max(0, Math.round(exemple.prix * (1 + nb / 100)));
      return `Exemple : ${exemple.nom} — ${formatPrice(exemple.prix)} → ${formatPrice(nouveau)}`;
    }
    return "";
  };

  const valider = async () => {
    const a = construireAction();
    if (!a) return;
    const message =
      a.type === "publier"
        ? `Publier ${ids.length} produit(s) ?`
        : a.type === "masquer"
          ? `Masquer ${ids.length} produit(s) ?`
          : a.type === "categorie"
            ? `Changer la catégorie de ${ids.length} produit(s) ?`
            : `Changer le prix de ${ids.length} produit(s) ?\n${apercu()}`;
    if (!window.confirm(message)) return;

    setEnCours(true);
    setError(null);
    const result = await appliquerActionMasse(ids, a);
    setEnCours(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toutSelectionner(ids);
    setAction("");
    setValeur("");
    setCategorieId("");
    setSousCategorieId("");
    router.refresh();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center gap-2 border-t border-ink/10 bg-white p-3 shadow-lg sm:sticky sm:rounded-2xl sm:border">
      <span className="text-sm font-medium text-ink">{ids.length} sélectionné{ids.length > 1 ? "s" : ""}</span>
      <ChampSelect
        options={OPTIONS_ACTION}
        value={action}
        onChange={setAction}
        placeholder="Choisir une action"
        className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
      />
      {(action === "prix_montant" || action === "prix_pourcentage") && (
        <input
          type="number"
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          placeholder={action === "prix_montant" ? "ex: -200 ou 500" : "ex: -10 ou 5"}
          className="w-32 rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        />
      )}
      {action === "categorie" && (
        <>
          <ChampSelect
            options={categories.map((c) => ({ value: String(c.id), label: c.nom }))}
            value={categorieId}
            onChange={(v) => {
              setCategorieId(v);
              setSousCategorieId("");
            }}
            placeholder="Catégorie"
            className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
          />
          {sousCatsDeLaCategorie.length > 0 && (
            <ChampSelect
              options={sousCatsDeLaCategorie.map((sc) => ({ value: String(sc.id), label: sc.nom }))}
              value={sousCategorieId}
              onChange={setSousCategorieId}
              placeholder="Sous-catégorie"
              className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
            />
          )}
        </>
      )}
      <button
        type="button"
        onClick={valider}
        disabled={
          enCours ||
          !action ||
          ((action === "prix_montant" || action === "prix_pourcentage") && valeur.trim() === "") ||
          (action === "categorie" && !categorieId)
        }
        className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-surface disabled:opacity-40"
      >
        {enCours ? "…" : "Appliquer"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
