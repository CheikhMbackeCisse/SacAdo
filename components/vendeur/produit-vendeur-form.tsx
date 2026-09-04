"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from "lucide-react";
import {
  creerMonProduit,
  modifierMonProduit,
  televerserPhoto,
  type ProduitVendeurInput,
} from "@/lib/vendeur/produits-actions";
import { remplacerMesVariantes } from "@/lib/vendeur/variantes-actions";
import { MAX_PHOTOS_PRODUIT } from "@/lib/vendeur/produits-shared";
import { compresserImage } from "@/lib/images/compress-image";
import { ChampSelect } from "@/components/ui/champ-select";
import {
  VariantesEditor,
  ETAT_VARIANTES_VIDE,
  etatDepuisVariantes,
  etatVariantesValide,
  etatVersLignes,
  type EtatVariantes,
} from "@/components/vendeur/variantes-editor";
import { useConfirmLeave, useUnsavedChanges } from "@/components/ui/navigation-guard";
import type {
  Attribut,
  Categorie,
  Commission,
  Produit,
  SousCategorie,
  SousSousCategorie,
  VarianteAvecAttributs,
} from "@/lib/supabase/types";
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
  sousSousCategories,
  commissions,
  attributs,
  variantesInitiales = [],
}: {
  produit?: Produit;
  categories: Categorie[];
  sousCategories: SousCategorie[];
  sousSousCategories: SousSousCategorie[];
  commissions: Commission[];
  attributs: Attribut[];
  variantesInitiales?: VarianteAvecAttributs[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const categoriesUtilisables = useMemo(
    () => categories.filter((c) => c.slug !== "kits"),
    [categories],
  );

  const [nom, setNom] = useState(produit?.nom ?? "");
  const [description, setDescription] = useState(produit?.description ?? "");
  const [commentaire, setCommentaire] = useState(produit?.commentaire_vendeur ?? "");
  // Selects sans valeur par défaut : le vendeur DOIT choisir activement, sinon
  // des produits atterrissent dans la mauvaise catégorie sans qu'il l'ait voulu.
  const [categorieId, setCategorieId] = useState<number | "">(produit?.categorie_id ?? "");
  const [sousCategorieId, setSousCategorieId] = useState<number | null>(
    produit?.sous_categorie_id ?? null,
  );
  const [sousSousCategorieId, setSousSousCategorieId] = useState<number | null>(
    produit?.sous_sous_categorie_id ?? null,
  );
  const [prix, setPrix] = useState(produit?.prix?.toString() ?? "");
  const [stock, setStock] = useState(produit?.stock?.toString() ?? "0");
  // Le délai de livraison n'est plus demandé au vendeur : c'est SacAdo qui livre
  // et garantit le délai. Valeur conservée pour l'affichage storefront.
  const delai: ProduitVendeurInput["delai"] = produit?.delai ?? "6j";
  const [photos, setPhotos] = useState<string[]>(
    produit?.photos?.length ? produit.photos : produit?.photo ? [produit.photo] : [],
  );
  const [variantes, setVariantes] = useState<EtatVariantes>(() =>
    variantesInitiales.length ? etatDepuisVariantes(variantesInitiales) : ETAT_VARIANTES_VIDE,
  );

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  // Garde de navigation (CONFIRMATION_RETOUR.md) : on compare aux valeurs
  // initiales — un formulaire simplement ouvert (rien touché) ne déclenche rien.
  const [initial] = useState(() => ({
    nom: produit?.nom ?? "",
    description: produit?.description ?? "",
    commentaire: produit?.commentaire_vendeur ?? "",
    categorieId: (produit?.categorie_id ?? "") as number | "",
    sousCategorieId: produit?.sous_categorie_id ?? null,
    sousSousCategorieId: produit?.sous_sous_categorie_id ?? null,
    prix: produit?.prix?.toString() ?? "",
    stock: produit?.stock?.toString() ?? "0",
    photos: (produit?.photos?.length
      ? produit.photos
      : produit?.photo
        ? [produit.photo]
        : []
    ).join("|"),
    variantes: JSON.stringify(
      variantesInitiales.length ? etatDepuisVariantes(variantesInitiales) : ETAT_VARIANTES_VIDE,
    ),
  }));
  const modifie =
    !enregistre &&
    (nom !== initial.nom ||
      description !== initial.description ||
      commentaire !== initial.commentaire ||
      categorieId !== initial.categorieId ||
      sousCategorieId !== initial.sousCategorieId ||
      sousSousCategorieId !== initial.sousSousCategorieId ||
      prix !== initial.prix ||
      stock !== initial.stock ||
      photos.join("|") !== initial.photos ||
      JSON.stringify(variantes) !== initial.variantes);
  useUnsavedChanges(modifie);
  const confirmerDepart = useConfirmLeave();

  const sousCatsDeLaCategorie = useMemo(
    () =>
      sousCategories
        .filter((sc) => sc.categorie_id === categorieId)
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)),
    [sousCategories, categorieId],
  );

  // 3e niveau : n'existe que pour certaines sous-catégories (SOUS_SOUS_CATEGORIES.md §2).
  const sousSousCatsDeLaSousCategorie = useMemo(
    () =>
      sousSousCategories
        .filter((ssc) => ssc.sous_categorie_id === sousCategorieId)
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)),
    [sousSousCategories, sousCategorieId],
  );
  const sousSousCategorieRequise =
    sousCategorieId != null && sousSousCatsDeLaSousCategorie.length > 0;

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
    // Un changement de catégorie invalide de toute façon le 3e niveau choisi.
    setSousSousCategorieId(null);
  };

  const changerSousCategorie = (valeur: number | null) => {
    setSousCategorieId(valeur);
    const encoreValide = sousSousCategories.some(
      (ssc) => ssc.id === sousSousCategorieId && ssc.sous_categorie_id === valeur,
    );
    if (!encoreValide) setSousSousCategorieId(null);
  };

  const placesLibres = MAX_PHOTOS_PRODUIT - photos.length;

  const choisirPhotos = async (fichiers: File[]) => {
    if (fichiers.length === 0 || placesLibres <= 0) return;
    setUploading(true);
    setError(null);
    const aTraiter = fichiers.slice(0, placesLibres);
    const urls: string[] = [];
    for (const fichier of aTraiter) {
      const compresse = await compresserImage(fichier);
      const formData = new FormData();
      formData.append("file", compresse);
      const result = await televerserPhoto(formData);
      if (!result.ok) {
        setError(result.error);
        break;
      }
      urls.push(result.url);
    }
    if (urls.length > 0) setPhotos((current) => [...current, ...urls]);
    setUploading(false);
  };

  const retirerPhoto = (index: number) => {
    setPhotos((current) => current.filter((_, i) => i !== index));
  };

  const deplacerPhoto = (index: number, direction: -1 | 1) => {
    setPhotos((current) => {
      const cible = index + direction;
      if (cible < 0 || cible >= current.length) return current;
      const copie = [...current];
      [copie[index], copie[cible]] = [copie[cible], copie[index]];
      return copie;
    });
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
    if (sousSousCategorieRequise && sousSousCategorieId == null) {
      setError("Veuillez choisir une sous-sous-catégorie.");
      return;
    }
    const erreurVariantes = etatVariantesValide(variantes);
    if (erreurVariantes) {
      setError(erreurVariantes);
      return;
    }

    setSubmitting(true);

    const input: ProduitVendeurInput = {
      nom: nom.trim(),
      description: description.trim() || null,
      categorie_id: categorieId,
      sous_categorie_id: sousCategorieId,
      sous_sous_categorie_id: sousSousCategorieId,
      prix: Number(prix),
      delai,
      photos,
      stock: Number(stock),
      commentaire_vendeur: commentaire.trim() || null,
    };

    const result = produit
      ? await modifierMonProduit(produit.id, input)
      : await creerMonProduit(input);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    // Produit enregistré : on applique le jeu de variantes (créées en lot juste
    // après la création, mises à jour / retirées en édition).
    const produitId: number | undefined =
      produit?.id ?? (result as { id?: number }).id;
    const lignes = etatVersLignes(variantes);
    if (produitId && (produit || lignes.length > 0)) {
      const rv = await remplacerMesVariantes(produitId, lignes);
      if (!rv.ok) {
        setEnregistre(true);
        router.push(`/vendeur/produits/${produitId}`);
        router.refresh();
        setError(
          `Produit enregistré, mais les variantes n'ont pas pu l'être : ${rv.error} Reprends-les sur la fiche.`,
        );
        return;
      }
    }

    setEnregistre(true);
    router.push(produit ? "/vendeur/produits" : `/vendeur/produits/${produitId}`);
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
          <ChampSelect
            ariaLabel="Catégorie"
            placeholder="Choisir une catégorie…"
            className={CHAMP}
            value={categorieId === "" ? "" : String(categorieId)}
            onChange={(v) => changerCategorie(v === "" ? "" : Number(v))}
            options={categoriesUtilisables.map((c) => ({ value: String(c.id), label: c.nom }))}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#001314]/60">Sous-catégorie</span>
          <ChampSelect
            ariaLabel="Sous-catégorie"
            disabled={categorieId === "" || sousCatsDeLaCategorie.length === 0}
            placeholder={
              categorieId === ""
                ? "Choisir d’abord une catégorie"
                : sousCatsDeLaCategorie.length === 0
                  ? "Aucune sous-catégorie"
                  : "Choisir une sous-catégorie…"
            }
            className={`${CHAMP} disabled:bg-[#001314]/[0.04] disabled:text-[#001314]/40`}
            value={sousCategorieId ? String(sousCategorieId) : ""}
            onChange={(v) => changerSousCategorie(v ? Number(v) : null)}
            options={sousCatsDeLaCategorie.map((sc) => ({ value: String(sc.id), label: sc.nom }))}
          />
        </label>
      </div>

      {/* 3e niveau : n'apparaît QUE si la sous-catégorie choisie en propose un
          (SOUS_SOUS_CATEGORIES.md §2). */}
      {sousSousCatsDeLaSousCategorie.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[#001314]/60">Sous-sous-catégorie</span>
          <ChampSelect
            ariaLabel="Sous-sous-catégorie"
            placeholder="Choisir une sous-sous-catégorie…"
            className={CHAMP}
            value={sousSousCategorieId ? String(sousSousCategorieId) : ""}
            onChange={(v) => setSousSousCategorieId(v ? Number(v) : null)}
            options={sousSousCatsDeLaSousCategorie.map((ssc) => ({
              value: String(ssc.id),
              label: ssc.nom,
            }))}
          />
        </label>
      )}

      {nomCategorie && (
        <p className="-mt-1 text-xs text-[#001314]/55">
          Commission SacAdo sur{" "}
          <span className="font-medium text-[#001314]/75">
            {nomSousCategorie ?? nomCategorie}
          </span>{" "}
          : <span className="font-semibold text-[#001314]">{tauxApplique}%</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-xs font-medium text-[#001314]/60">
          Photos <span className="text-[#001314]/40">({photos.length}/{MAX_PHOTOS_PRODUIT})</span>
        </span>

        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {photos.map((url, index) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-xl border border-[#001314]/10 bg-[#001314]/5"
              >
                <Image src={url} alt="" fill sizes="120px" className="object-cover" />

                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded-full bg-[#0B3D91] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    Principale
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => retirerPhoto(index)}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-[#001314] shadow"
                  aria-label="Retirer cette photo"
                >
                  <X size={12} />
                </button>

                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  <button
                    type="button"
                    onClick={() => deplacerPhoto(index, -1)}
                    disabled={index === 0}
                    className="rounded-full bg-white/90 p-0.5 text-[#001314] shadow disabled:opacity-30"
                    aria-label="Déplacer vers la gauche"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deplacerPhoto(index, 1)}
                    disabled={index === photos.length - 1}
                    className="rounded-full bg-white/90 p-0.5 text-[#001314] shadow disabled:opacity-30"
                    aria-label="Déplacer vers la droite"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {placesLibres > 0 && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex w-fit items-center gap-1.5 rounded-full border border-[#001314]/15 px-3 py-1.5 text-xs font-medium text-[#001314]/70 hover:bg-[#001314]/[0.04] disabled:opacity-50"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {photos.length === 0 ? "Ajouter des photos" : "Ajouter une photo"}
          </button>
        )}

        <p className="text-[11px] text-[#001314]/45">
          JPG, PNG ou WebP — jusqu’à {MAX_PHOTOS_PRODUIT} photos. La première est la photo
          principale (grille du catalogue et début du carrousel) ; réordonnez avec les flèches.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const fichiers = Array.from(e.target.files ?? []);
            if (fichiers.length > 0) void choisirPhotos(fichiers);
            e.target.value = "";
          }}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-[#001314]/60">
          Commentaires / remarques sur ce produit (à l’attention de SacAdo)
        </span>
        <textarea
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          rows={3}
          maxLength={2000}
          className={CHAMP}
          placeholder="Précision, question, contexte… Ce mot n’apparaît pas sur la fiche publique."
        />
      </label>

      <VariantesEditor
        attributsDispo={attributs}
        prixProduit={prix}
        value={variantes}
        onChange={setVariantes}
      />

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
          onClick={async () => {
            if (await confirmerDepart()) router.push("/vendeur/produits");
          }}
          className="text-sm font-medium text-[#001314]/55 hover:text-[#001314]"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
