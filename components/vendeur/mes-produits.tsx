"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { StatutPublicationBadge } from "@/components/vendeur/statut-publication-badge";
import { formatPrice } from "@/lib/format";
import { mettreAJourStock, supprimerMonProduit } from "@/lib/vendeur/produits-actions";
import type { Produit } from "@/lib/supabase/types";

export function MesProduits({
  produits,
  categoriesNom,
}: {
  produits: Produit[];
  categoriesNom: Record<number, string>;
}) {
  if (produits.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#001314]/15 bg-white/60 p-8 text-center">
        <p className="text-sm text-[#001314]/60">Vous n&apos;avez pas encore de produit.</p>
        <Link
          href="/vendeur/produits/nouveau"
          className="mt-3 inline-block rounded-full bg-[#E07B39] px-4 py-2 text-sm font-semibold text-[#001314]"
        >
          Ajouter mon premier produit
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {produits.map((produit) => (
        <ProduitCarte
          key={produit.id}
          produit={produit}
          categorieNom={categoriesNom[produit.categorie_id] ?? "—"}
        />
      ))}
    </ul>
  );
}

function ProduitCarte({ produit, categorieNom }: { produit: Produit; categorieNom: string }) {
  const router = useRouter();
  const [stock, setStock] = useState(String(produit.stock));
  const [savingStock, setSavingStock] = useState(false);
  const [stockOk, setStockOk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stockChange = Number(stock) !== produit.stock;

  const enregistrerStock = async () => {
    setSavingStock(true);
    setError(null);
    const result = await mettreAJourStock(produit.id, Number(stock));
    setSavingStock(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStockOk(true);
    setTimeout(() => setStockOk(false), 1500);
    router.refresh();
  };

  const supprimer = async () => {
    setDeleting(true);
    setError(null);
    const result = await supprimerMonProduit(produit.id);
    if (!result.ok) {
      setError(result.error);
      setDeleting(false);
      setConfirmDelete(false);
      return;
    }
    router.refresh();
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[#001314]/10 bg-white p-3 sm:flex-row sm:items-start">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#001314]/5">
        <ProductImage src={produit.photo} alt={produit.nom} sizes="96px" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[#001314]">{produit.nom}</p>
          <StatutPublicationBadge statut={produit.statut_publication} />
        </div>
        <p className="mt-0.5 text-xs text-[#001314]/55">
          {categorieNom} · {formatPrice(produit.prix)} · livraison {produit.delai}
        </p>

        {produit.statut_publication === "refuse" && produit.motif_refus && (
          <p className="mt-1.5 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
            Motif du refus : {produit.motif_refus}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[#001314]/60">
            Stock
            <input
              type="number"
              min={0}
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              className="w-20 rounded-lg border border-[#001314]/15 px-2 py-1 text-sm text-[#001314] focus:border-[#0B3D91] focus:outline-none"
            />
          </label>
          {stockChange && (
            <button
              type="button"
              onClick={enregistrerStock}
              disabled={savingStock}
              className="rounded-full bg-[#0B3D91] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {savingStock ? <Loader2 size={13} className="animate-spin" /> : "Enregistrer"}
            </button>
          )}
          {stockOk && (
            <span className="flex items-center gap-1 text-xs font-medium text-[#166534]">
              <Check size={13} /> Stock à jour
            </span>
          )}
        </div>

        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        <Link
          href={`/vendeur/produits/${produit.id}`}
          className="flex items-center gap-1 rounded-full border border-[#001314]/15 px-3 py-1.5 text-xs font-medium text-[#001314]/70 hover:bg-[#001314]/[0.04]"
        >
          <Pencil size={13} aria-hidden="true" />
          Modifier
        </Link>
        {confirmDelete ? (
          <span className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={supprimer}
              disabled={deleting}
              className="rounded-full bg-red-600 px-2.5 py-1 font-semibold text-white disabled:opacity-50"
            >
              {deleting ? "…" : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-[#001314]/50"
            >
              Annuler
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            <Trash2 size={13} aria-hidden="true" />
            Retirer
          </button>
        )}
      </div>
    </li>
  );
}
