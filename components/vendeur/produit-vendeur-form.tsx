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
import type { Categorie, Commission, Produit, SousCategorie } from "@/lib/supabase/types";
import { calculerCommission, tauxCommission } from "@/lib/commissions";
import { formatPrice } from "@/lib/format";

const INK = "#001314";
const ACTION = "#E07B39";
const CHAMP =
  "rounded-xl border border-[#001314]/15 px-3 py-2 text-sm text-[#001314] focus:border-[#0B3D91] focus:outline-none focus:ring-2 focus:ring-[#0B3D91]/25";

export function ProduitVendeurForm({
  produit,
  categories,
  sousCategories,
  commissions,
}: {
  produit?: Produit;
  categories: Categorie[];
  sousCategories: SousCategorie[];
  commissions: Commission[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const categoriesUtilisables = useMemo(
    () => categories.filter((c) => c.slug !== "kits"),
    [categories],
  );

  const [nom, setNom] = useState(produit?.nom ?? "");
  const [description, setDescription] = useState(produit?.description ?? "");
  // Selects sans valeur par défaut : le vendeur DOIT choisir activement, sinon
  // des produits atterrissent dans la mauvaise catégorie sans qu'il l'ait voulu.
  const [categorieId, setCategorieId] = useState<number | "">(produit?.categorie_id ?? "");
  const [sousCategorieId, setSousCategorieId] = useState<number | null>(
    produit?.sous_categorie_id ?? null,
  );
  const [prix, setPrix] = useState(produit?.prix?.toString() ?? "");
  const [delai, setDelai] = useState<ProduitVendeurInput["delai"] | "">(produit?.delai ?? "");
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

  // Taux applicable à la catégorie / sous-catégorie choisie — affiché en
  // permanence dès qu'une catégorie est sélectionnée, même sans prix.
  const tauxApplique = useMemo(
    () =>
      categorieId === "" ? null : tauxCommission(commissions, categorieId, sousCategorieId),
    [commissions, categorieId, sousCategorieId],
  );

  const nomCategorie = categoriesUtilisables.find((c) => c.id === categorieId)?.nom ?? null;
  const nomSousCategorie =
    sousCategorieId != null
      ? (sousCategories.find((sc) => sc.id === sousCategorieId)?.nom ?? null)
      : null;

  const prixNombre = Number(prix);
  const apercuCommission = useMemo(() => {
    if (categorieId === "" || !Number.isFinite(prixNombre) || prixNombre <= 0) return null;
    return calculerCommission(prixNombre, commissions, categorieId, sousCategorieId);
  }, [prixNombre, commissions, categorieId, sousCategorieId]);

  // La sous-catégorie n'est demandée que si la catégorie en propose.
  const sousCategorieRequise = categorieId !== "" && sousCatsDeLaCategorie.length > 0;

  const changerCategorie = (valeur: number | "") => {
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
    setError(null);

    if (categorieId === "") {
      setError("Veuillez choisir une catégorie.");
      return;
    }
    if (sousCategorieRequise && sousCategorieId == null) {
      setError("Veuillez choisir une sous-catégorie.");
      return;
    }
    if (delai === "") {
      setError("Veuillez choisir un délai de livraison.");
      return;
    }

    setSubmitting(true);

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
            required
            value={categorieId}
            onChange={(e) => changerCategorie(e.target.value === "" ? "" : Number(e.target.value))}
            className={CHAMP}
          >
            <option value="" disabled>
              Choisir une catégorie…
            </option>
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
            required={sousCategorieRequise}
            disabled={categorieId === "" || sousCatsDeLaCategorie.length === 0}
            value={sousCategorieId ?? ""}
            onChange={(e) => setSousCategorieId(e.target.value ? Number(e.target.value) : null)}
            className={`${CHAMP} disabled:bg-[#001314]/[0.04] disabled:text-[#001314]/40`}
          >
            <option value="" disabled>
              {categorieId === ""
                ? "Choisir d’abord une catégorie"
                : sousCatsDeLaCategorie.length === 0
                  ? "Aucune sous-catégorie"
                  : "Choisir une sous-catégorie…"}
            </option>
            {sousCatsDeLaCategorie.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      {nomCategorie && (
        <p className="-mt-1 text-xs text-[#001314]/55">
          Commission SacAdo sur{" "}
          <span className="font-medium text-[#001314]/75">
            {nomSousCategorie ?? nomCategorie}
          </span>{" "}
          : <span className="font-semibold text-[#001314]">{tauxApplique}%</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#001314]/60">Prix (FCFA)</span>
          <input
            required
            type="number"
            inputMode="numeric"
            min={1}
            value={prix}
            onChange={(e) => setPrix(e.target.value)}
            className={`${CHAMP} no-spinner`}
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
            required
            value={delai}
            onChange={(e) => setDelai(e.target.value as ProduitVendeurInput["delai"] | "")}
            className={CHAMP}
          >
            <option value="" disabled>
              Choisir un délai…
            </option>
            <option value="24h">24h</option>
            <option value="5j">5 jours</option>
          </select>
        </label>
      </div>

      {apercuCommission && (
        <div className="-mt-1 flex flex-col gap-1 rounded-xl border border-[#001314]/10 bg-[#001314]/[0.03] px-3.5 py-3 text-sm">
          <div className="flex items-center justify-between text-[#001314]/70">
            <span>Commission SacAdo ({apercuCommission.taux}%)</span>
            <span>− {formatPrice(apercuCommission.commission)}</span>
          </div>
          <div className="flex items-center justify-between font-semibold text-[#001314]">
            <span>Vous recevez</span>
            <span>{formatPrice(apercuCommission.net)}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#001314]/45">
            Estimation. Le taux dépend de la catégorie choisie et peut être ajusté avant publication.
          </p>
        </div>
      )}

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
