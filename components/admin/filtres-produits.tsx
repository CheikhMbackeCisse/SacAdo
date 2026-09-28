"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ChampSelect, type OptionSelect } from "@/components/ui/champ-select";

type Props = {
  categories: OptionSelect[];
  sousCategories: OptionSelect[];
  vendeurs: OptionSelect[];
};

const STATUTS: OptionSelect[] = [
  { value: "publie", label: "Publié" },
  { value: "en_attente", label: "Masqué / en attente" },
  { value: "negociation", label: "En négociation" },
  { value: "refuse", label: "Refusé" },
];

const STOCKS: OptionSelect[] = [
  { value: "en_stock", label: "En stock" },
  { value: "rupture", label: "Rupture" },
];

const TRIS: OptionSelect[] = [
  { value: "nom", label: "Nom" },
  { value: "prix", label: "Prix" },
  { value: "stock", label: "Stock" },
  { value: "date", label: "Dernière modification" },
];

// Barre de recherche + filtres de /admin/produits. Pilote l'URL (searchParams)
// pour que la page reste un composant serveur : la recherche déclenche un
// `router.push`, débouncé 250 ms, qui refait le rendu serveur paginé.
export function FiltresProduits({ categories, sousCategories, vendeurs }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pousser = (next: URLSearchParams) => {
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  };

  const definir = (cle: string, valeur: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (valeur) next.set(cle, valeur);
    else next.delete(cle);
    pousser(next);
  };

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      if (q !== (searchParams.get("q") ?? "")) definir("q", q);
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sansImage = searchParams.get("sansImage") === "1";
  const sansSousCategorie = searchParams.get("sansSousCategorie") === "1";

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-ink/10 bg-white p-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit, un ID, un vendeur…"
          className="w-full rounded-xl border border-ink/15 py-2.5 pl-9 pr-3 text-sm text-ink"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <ChampSelect
          options={categories}
          value={searchParams.get("categorie") ?? ""}
          onChange={(v) => definir("categorie", v)}
          placeholder="Catégorie"
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        />
        <ChampSelect
          options={sousCategories}
          value={searchParams.get("sousCategorie") ?? ""}
          onChange={(v) => definir("sousCategorie", v)}
          placeholder="Sous-catégorie"
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        />
        <ChampSelect
          options={vendeurs}
          value={searchParams.get("vendeur") ?? ""}
          onChange={(v) => definir("vendeur", v)}
          placeholder="Vendeur"
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        />
        <ChampSelect
          options={STATUTS}
          value={searchParams.get("statut") ?? ""}
          onChange={(v) => definir("statut", v)}
          placeholder="Statut"
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        />
        <ChampSelect
          options={STOCKS}
          value={searchParams.get("stock") ?? ""}
          onChange={(v) => definir("stock", v)}
          placeholder="Stock"
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        />
        <ChampSelect
          options={TRIS}
          value={searchParams.get("tri") ?? "nom"}
          onChange={(v) => definir("tri", v)}
          placeholder="Trier par"
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-ink/60">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={sansImage}
            onChange={(e) => definir("sansImage", e.target.checked ? "1" : "")}
          />
          Sans image
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={sansSousCategorie}
            onChange={(e) => definir("sansSousCategorie", e.target.checked ? "1" : "")}
          />
          Sans sous-catégorie
        </label>
      </div>
    </div>
  );
}
