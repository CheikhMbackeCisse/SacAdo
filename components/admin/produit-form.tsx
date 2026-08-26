"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { creerProduit, modifierProduit, type ProduitInput } from "@/lib/admin/produits-actions";
import { CATEGORIES } from "@/lib/categories";
import type { Produit } from "@/lib/supabase/types";

const CATEGORIES_PRODUIT = CATEGORIES.filter((c) => c.categorieDb).map((c) => c.categorieDb as string);

export function ProduitForm({ produit }: { produit?: Produit }) {
  const router = useRouter();
  const [nom, setNom] = useState(produit?.nom ?? "");
  const [categorie, setCategorie] = useState(produit?.categorie ?? CATEGORIES_PRODUIT[0]);
  const [prix, setPrix] = useState(produit?.prix?.toString() ?? "");
  const [delai, setDelai] = useState<ProduitInput["delai"]>(produit?.delai ?? "24h");
  const [photo, setPhoto] = useState(produit?.photo ?? "");
  const [stock, setStock] = useState(produit?.stock?.toString() ?? "0");
  const [seuilAlerte, setSeuilAlerte] = useState(produit?.seuil_alerte?.toString() ?? "5");
  const [statut, setStatut] = useState<ProduitInput["statut"]>(produit?.statut ?? "dispo");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const input: ProduitInput = {
      nom: nom.trim(),
      categorie,
      prix: Number(prix),
      delai,
      photo: photo.trim() || null,
      stock: Number(stock),
      seuil_alerte: Number(seuilAlerte),
      statut,
    };

    const result = produit ? await modifierProduit(produit.id, input) : await creerProduit(input);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push("/admin/produits");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex max-w-xl flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-5"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Nom</span>
        <input
          required
          value={nom}
          onChange={(event) => setNom(event.target.value)}
          className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Catégorie</span>
          <select
            value={categorie}
            onChange={(event) => setCategorie(event.target.value)}
            className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          >
            {CATEGORIES_PRODUIT.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Délai</span>
          <select
            value={delai}
            onChange={(event) => setDelai(event.target.value as ProduitInput["delai"])}
            className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          >
            <option value="24h">24h</option>
            <option value="5j">5 jours</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Prix (FCFA)</span>
          <input
            required
            type="number"
            min={0}
            value={prix}
            onChange={(event) => setPrix(event.target.value)}
            className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Stock</span>
          <input
            required
            type="number"
            min={0}
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Seuil d&apos;alerte</span>
          <input
            required
            type="number"
            min={0}
            value={seuilAlerte}
            onChange={(event) => setSeuilAlerte(event.target.value)}
            className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Statut</span>
        <select
          value={statut}
          onChange={(event) => setStatut(event.target.value as ProduitInput["statut"])}
          className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        >
          <option value="dispo">Disponible</option>
          <option value="sur_commande">Sur commande</option>
          <option value="epuise">Épuisé</option>
        </select>
        <span className="text-[11px] text-ink/40">
          Repasse automatiquement à « épuisé » si le stock tombe à 0.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Photo (chemin, ex: /images/prod-x.jpg)</span>
        <input
          value={photo}
          onChange={(event) => setPhoto(event.target.value)}
          className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-surface transition-transform active:scale-95 disabled:opacity-50"
      >
        {submitting ? "Enregistrement…" : produit ? "Enregistrer" : "Créer le produit"}
      </button>
    </form>
  );
}
