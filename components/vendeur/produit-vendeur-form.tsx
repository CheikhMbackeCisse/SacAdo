"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  creerMonProduit,
  modifierMonProduit,
  televerserPhoto,
  type ProduitVendeurInput,
} from "@/lib/vendeur/produits-actions";
import type { Categorie, Produit, SousCategorie } from "@/lib/supabase/types";

const INK = "#001314";
const ACTION = "#E07B39";
const CHAMP =
  "rounded-xl border border-[#001314]/15 px-3 py-2 text-sm text-[#001314] focus:border-[#0B3D91] focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/25";

export function ProduitVendeurForm({
  produit,
  categories,
  sousCategories,
}: {
  produit?: Produit;
  categories: Categorie[];
  sousCategories: SousCategorie[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const categoriesUtilisables = useMemo(
    () => categories.filter((c) => c.slug !== "kits"),
    [categories],
  );

  const [nom, setNom] = useState(produit?.nom ?? "");
  const [description, setDescription] = useState(produit?.description ?? "");
  const [categorieId, setCategorieId] = useState<number>(
    produit?.categorie_id ?? categoriesUtilisables[0]?.id ?? 0,
  );
  const [sousCategorieId, setSousCategorieId] = useState<number | null>(
    produit?.sous_categorie_id ?? null,
  );
  const [prix, setPrix] = useState(produit?.prix?.toString() ?? "");
  const [delai, setDelai] = useState<ProduitVendeurInput["delai"]>(produit?.delai ?? "5j");
  const [stock, setStock] = useState(produit?.stock?.toString() ?? "0");
  const [photo, setPhoto] = useState(produit?.photo ?? "");

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sousCatsDeLaCategorie = useMemo(
    () =>
      sousCategories
        .filter((sc) => sc.categorie_id === categorieId)
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)),
    [sousCategories, categorieId],
  );

  const changerCategorie = (valeur: number) => {
    setCategorieId(valeur);
    const encoreValide = sousCategories.some(
      (sc) => sc.id === sousCategorieId && sc.categorie_id === valeur,
    );
    if (!encoreValide) setSousCategorieId(null);
  };

  const choisirPhoto = async (fichier: File) => {
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", fichier);
    const result = await televerserPhoto(formData);
    setUploading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPhoto(result.url);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const input: ProduitVendeurInput = {
      nom: nom.trim(),
      description: description.trim() || null,
      categorie_id: categorieId,
      sous_categorie_id: sousCategorieId,
      prix: Number(prix),
      delai,
      photo: photo || null,
      stock: Number(stock),
    };

    const result = produit
      ? await modifierMonProduit(produit.id, input)
      : await creerMonProduit(input);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push("/vendeur/produits");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-[#001314]/10 bg-white p-5"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-[#001314]/60">Nom du produit</span>
        <input required value={nom} onChange={(e) => setNom(e.target.value)} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-[#001314]/60">Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          className={CHAMP}
          placeholder="Matière, dimensions, contenu…"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#001314]/60">Catégorie</span>
          <select
            value={categorieId}
            onChange={(e) => changerCategorie(Number(e.target.value))}
            className={CHAMP}
          >
            {categoriesUtilisables.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nom}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#001314]/60">Sous-catégorie</span>
          <select
            value={sousCategorieId ?? ""}
            onChange={(e) => setSousCategorieId(e.target.value ? Number(e.target.value) : null)}
            className={CHAMP}
          >
            <option value="">— Aucune —</option>
            {sousCatsDeLaCategorie.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#001314]/60">Prix (FCFA)</span>
          <input
            required
            type="number"
            min={1}
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#001314]/60">Stock</span>
          <input
            required
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#001314]/60">Délai de livraison</span>
          <select
            value={delai}
            onChange={(e) => setDelai(e.target.value as ProduitVendeurInput["delai"])}
            className={CHAMP}
          >
            <option value="24h">24h</option>
            <option value="5j">5 jours</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs font-medium text-[#001314]/60">Photo</span>
        <div className="flex items-center gap-3">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#001314]/10 bg-[#001314]/5">
            {photo ? (
              <>
                <Image src={photo} alt="" fill sizes="96px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => setPhoto("")}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-[#001314] shadow"
                  aria-label="Retirer la photo"
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <span className="flex h-full items-center justify-center text-[#001314]/25">
                <ImagePlus size={22} aria-hidden="true" />
              </span>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-full border border-[#001314]/15 px-3 py-1.5 text-xs font-medium text-[#001314]/70 hover:bg-[#001314]/[0.04] disabled:opacity-50"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {photo ? "Changer la photo" : "Téléverser une photo"}
            </button>
            <p className="mt-1 text-[11px] text-[#001314]/45">JPG, PNG ou WebP — 3 Mo max.</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              if (fichier) choisirPhoto(fichier);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || uploading}
          className="rounded-full px-5 py-2.5 text-sm font-semibold transition-transform active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: ACTION, color: INK }}
        >
          {submitting
            ? "Enregistrement…"
            : produit
              ? "Enregistrer et renvoyer en validation"
              : "Ajouter le produit"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/vendeur/produits")}
          className="text-sm font-medium text-[#001314]/55 hover:text-[#001314]"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
