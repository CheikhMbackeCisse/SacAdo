"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from "lucide-react";
import {
  creerProduit,
  modifierProduit,
  televerserPhotoAdmin,
  type ProduitInput,
} from "@/lib/admin/produits-actions";
import { creerSousCategorie } from "@/lib/admin/sous-categories-actions";
import { creerSousSousCategorie } from "@/lib/admin/sous-sous-categories-actions";
import { compresserImage } from "@/lib/images/compress-image";
import { MAX_PHOTOS_PRODUIT } from "@/lib/vendeur/produits-shared";
import { ChampSelect } from "@/components/ui/champ-select";
import type { Categorie, Produit, SousCategorie, SousSousCategorie } from "@/lib/supabase/types";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

type Props = {
  produit?: Produit;
  categories: Categorie[];
  sousCategories: SousCategorie[];
  sousSousCategories: SousSousCategorie[];
};

export function ProduitForm({ produit, categories, sousCategories, sousSousCategories }: Props) {
  const router = useRouter();

  // "Kits scolaires" ne porte pas de produits (ils vivent dans la table kits).
  const categoriesUtilisables = useMemo(
    () => categories.filter((c) => c.slug !== "kits"),
    [categories],
  );

  const [nom, setNom] = useState(produit?.nom ?? "");
  // Selects sans valeur par défaut : forcer un choix explicite (sinon un produit
  // est rangé dans la première catégorie sans que l'admin l'ait décidé).
  const [categorieId, setCategorieId] = useState<number | "">(produit?.categorie_id ?? "");
  const [sousCategorieId, setSousCategorieId] = useState<number | null>(
    produit?.sous_categorie_id ?? null,
  );
  const [sousSousCategorieId, setSousSousCategorieId] = useState<number | null>(
    produit?.sous_sous_categorie_id ?? null,
  );
  const [prix, setPrix] = useState(produit?.prix?.toString() ?? "");
  const [prixAchat, setPrixAchat] = useState(produit?.prix_achat?.toString() ?? "");
  const [delai, setDelai] = useState<ProduitInput["delai"] | "">(produit?.delai ?? "");
  const [photos, setPhotos] = useState<string[]>(
    produit?.photos?.length ? produit.photos : produit?.photo ? [produit.photo] : [],
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [stock, setStock] = useState(produit?.stock?.toString() ?? "0");
  const [seuilAlerte, setSeuilAlerte] = useState(produit?.seuil_alerte?.toString() ?? "5");
  const [statut, setStatut] = useState<ProduitInput["statut"]>(produit?.statut ?? "dispo");
  const [motsCles, setMotsCles] = useState(produit?.mots_cles ?? "");
  const [guideTailles, setGuideTailles] = useState(produit?.guide_tailles ?? false);
  const [miseEnAvant, setMiseEnAvant] = useState(produit?.mise_en_avant ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sous-catégories créées à la volée depuis ce formulaire, fusionnées à la liste.
  const [sousCatsAjoutees, setSousCatsAjoutees] = useState<SousCategorie[]>([]);
  const [nouvelleSousCat, setNouvelleSousCat] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);

  // Idem pour le 3e niveau, optionnel (SOUS_SOUS_CATEGORIES.md).
  const [sousSousCatsAjoutees, setSousSousCatsAjoutees] = useState<SousSousCategorie[]>([]);
  const [nouvelleSousSousCat, setNouvelleSousSousCat] = useState("");
  const [creationSousSousEnCours, setCreationSousSousEnCours] = useState(false);

  const toutesSousCats = useMemo(
    () => [...sousCategories, ...sousCatsAjoutees],
    [sousCategories, sousCatsAjoutees],
  );

  const toutesSousSousCats = useMemo(
    () => [...sousSousCategories, ...sousSousCatsAjoutees],
    [sousSousCategories, sousSousCatsAjoutees],
  );

  const sousCatsDeLaCategorie = useMemo(
    () =>
      toutesSousCats
        .filter((sc) => sc.categorie_id === categorieId)
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)),
    [toutesSousCats, categorieId],
  );

  const sousSousCatsDeLaSousCategorie = useMemo(
    () =>
      toutesSousSousCats
        .filter((ssc) => ssc.sous_categorie_id === sousCategorieId)
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)),
    [toutesSousSousCats, sousCategorieId],
  );

  const sousCategorieRequise = categorieId !== "" && sousCatsDeLaCategorie.length > 0;
  const sousSousCategorieRequise =
    sousCategorieId != null && sousSousCatsDeLaSousCategorie.length > 0;

  const changerCategorie = (valeur: number | "") => {
    setCategorieId(valeur);
    const encoreValide = toutesSousCats.some(
      (sc) => sc.id === sousCategorieId && sc.categorie_id === valeur,
    );
    if (!encoreValide) setSousCategorieId(null);
    setSousSousCategorieId(null);
  };

  const changerSousCategorie = (valeur: number | null) => {
    setSousCategorieId(valeur);
    const encoreValide = toutesSousSousCats.some(
      (ssc) => ssc.id === sousSousCategorieId && ssc.sous_categorie_id === valeur,
    );
    if (!encoreValide) setSousSousCategorieId(null);
  };

  const ajouterSousCat = async () => {
    const nomSC = nouvelleSousCat.trim();
    if (!nomSC || !categorieId) return;
    setCreationEnCours(true);
    setError(null);
    const result = await creerSousCategorie({
      nom: nomSC,
      categorie_id: categorieId,
      ordre: 0,
    });
    setCreationEnCours(false);
    if (!result.ok || !result.id) {
      setError(result.ok ? "Création impossible." : result.error);
      return;
    }
    const creee: SousCategorie = {
      id: result.id,
      nom: nomSC,
      categorie_id: categorieId,
      slug: "",
      ordre: 0,
      created_at: new Date().toISOString(),
    };
    setSousCatsAjoutees((current) => [...current, creee]);
    setSousCategorieId(result.id);
    setNouvelleSousCat("");
  };

  const ajouterSousSousCat = async () => {
    const nomSSC = nouvelleSousSousCat.trim();
    if (!nomSSC || sousCategorieId == null) return;
    setCreationSousSousEnCours(true);
    setError(null);
    const result = await creerSousSousCategorie({
      nom: nomSSC,
      sous_categorie_id: sousCategorieId,
      ordre: 0,
    });
    setCreationSousSousEnCours(false);
    if (!result.ok || !result.id) {
      setError(result.ok ? "Création impossible." : result.error);
      return;
    }
    const creee: SousSousCategorie = {
      id: result.id,
      nom: nomSSC,
      sous_categorie_id: sousCategorieId,
      slug: "",
      ordre: 0,
      created_at: new Date().toISOString(),
    };
    setSousSousCatsAjoutees((current) => [...current, creee]);
    setSousSousCategorieId(result.id);
    setNouvelleSousSousCat("");
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
      const result = await televerserPhotoAdmin(formData);
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
    if (delai === "") {
      setError("Veuillez choisir un délai.");
      return;
    }

    setSubmitting(true);

    const input: ProduitInput = {
      nom: nom.trim(),
      categorie_id: categorieId,
      sous_categorie_id: sousCategorieId,
      sous_sous_categorie_id: sousSousCategorieId,
      prix: Number(prix),
      prix_achat: prixAchat.trim() === "" ? null : Number(prixAchat),
      delai,
      photo: photos[0] ?? null,
      photos,
      stock: Number(stock),
      seuil_alerte: Number(seuilAlerte),
      statut,
      mots_cles: motsCles.trim() || null,
      guide_tailles: guideTailles,
      mise_en_avant: miseEnAvant,
    };

    const result = produit ? await modifierProduit(produit.id, input) : await creerProduit(input);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    // Après création, on ouvre directement la fiche du produit : c'est là que
    // se trouve la section « Variantes » (Couleur, Taille…), qui a besoin de
    // l'id du produit.
    const idCree = !produit && "id" in result ? result.id : undefined;
    router.push(idCree ? `/admin/produits/${idCree}` : "/admin/produits");
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
          className="min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Catégorie</span>
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
          <span className="text-xs font-medium text-ink/60">Délai</span>
          <ChampSelect
            ariaLabel="Délai de livraison"
            placeholder="Choisir un délai…"
            className={CHAMP}
            value={delai}
            onChange={(v) => setDelai(v as ProduitInput["delai"] | "")}
            options={[
              { value: "24h", label: "24h" },
              { value: "6j", label: "À date donnée" },
            ]}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Sous-catégorie</span>
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
          className={`${CHAMP} disabled:bg-ink/[0.04] disabled:text-ink/40`}
          value={sousCategorieId ? String(sousCategorieId) : ""}
          onChange={(v) => changerSousCategorie(v ? Number(v) : null)}
          options={sousCatsDeLaCategorie.map((sc) => ({ value: String(sc.id), label: sc.nom }))}
        />
        <span className="flex flex-wrap items-center gap-2 pt-1">
          <input
            value={nouvelleSousCat}
            onChange={(event) => setNouvelleSousCat(event.target.value)}
            placeholder="Nouvelle sous-catégorie"
            className="flex-1 rounded-lg border border-ink/15 px-2 py-1 text-xs focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={ajouterSousCat}
            disabled={creationEnCours || !nouvelleSousCat.trim()}
            className="rounded-full border border-brand/40 px-3 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/5 disabled:opacity-40"
          >
            Créer
          </button>
        </span>
      </label>

      {/* 3e niveau : n'apparaît QUE si la sous-catégorie choisie en propose un
          (SOUS_SOUS_CATEGORIES.md §2). */}
      {sousCategorieId != null && sousSousCatsDeLaSousCategorie.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Sous-sous-catégorie</span>
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
          <span className="flex flex-wrap items-center gap-2 pt-1">
            <input
              value={nouvelleSousSousCat}
              onChange={(event) => setNouvelleSousSousCat(event.target.value)}
              placeholder="Nouvelle sous-sous-catégorie"
              className="flex-1 rounded-lg border border-ink/15 px-2 py-1 text-xs focus:border-brand focus:outline-none"
            />
            <button
              type="button"
              onClick={ajouterSousSousCat}
              disabled={creationSousSousEnCours || !nouvelleSousSousCat.trim()}
              className="rounded-full border border-brand/40 px-3 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand/5 disabled:opacity-40"
            >
              Créer
            </button>
          </span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Prix (FCFA)</span>
          <input
            required
            type="number"
            inputMode="numeric"
            min={0}
            value={prix}
            onChange={(event) => setPrix(event.target.value)}
            className="no-spinner min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-ink/60">Prix d&apos;achat</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={prixAchat}
            onChange={(event) => setPrixAchat(event.target.value)}
            placeholder="facultatif"
            className="no-spinner min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
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
            className="min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
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
            className="min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Statut</span>
        <select
          value={statut}
          onChange={(event) => setStatut(event.target.value as ProduitInput["statut"])}
          className="min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        >
          <option value="dispo">Disponible</option>
          <option value="sur_commande">Sur commande</option>
          <option value="epuise">Épuisé</option>
        </select>
        <span className="text-[11px] text-ink/40">
          Le stock n&apos;influence plus ce statut : c&apos;est toi qui décides.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Mots-clés de recherche</span>
        <textarea
          value={motsCles}
          onChange={(event) => setMotsCles(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="flash, clef usb, sandisk"
          className="rounded-xl border border-ink/15 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
        <span className="text-[11px] text-ink/40">
          Ce que les clients tapent et qui n&apos;est pas dans le nom du produit. Jamais affiché
          au client. Les équivalences générales (« bic » = stylo) se règlent une fois pour
          toutes dans Synonymes.
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={guideTailles}
          onChange={(event) => setGuideTailles(event.target.checked)}
          className="size-4 rounded border-ink/25"
        />
        <span className="text-xs font-medium text-ink/60">
          Afficher le guide des tailles sur la fiche (vêtements à variantes de taille)
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={miseEnAvant}
          onChange={(event) => setMiseEnAvant(event.target.checked)}
          className="size-4 rounded border-ink/25"
        />
        <span className="text-xs font-medium text-ink/60">Mettre en avant sur l&apos;accueil</span>
      </label>

      <div className="flex flex-col gap-2 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Photos <span className="text-ink/40">({photos.length}/{MAX_PHOTOS_PRODUIT})</span>
        </span>

        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {photos.map((url, index) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-xl border border-ink/10 bg-ink/5"
              >
                <Image src={url} alt="" fill sizes="120px" className="object-cover" />
                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-semibold text-surface">
                    Principale
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => retirerPhoto(index)}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-ink shadow"
                  aria-label="Retirer cette photo"
                >
                  <X size={12} />
                </button>
                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  <button
                    type="button"
                    onClick={() => deplacerPhoto(index, -1)}
                    disabled={index === 0}
                    className="rounded-full bg-white/90 p-0.5 text-ink shadow disabled:opacity-30"
                    aria-label="Déplacer vers la gauche"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deplacerPhoto(index, 1)}
                    disabled={index === photos.length - 1}
                    className="rounded-full bg-white/90 p-0.5 text-ink shadow disabled:opacity-30"
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
            className="flex w-fit items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/[0.04] disabled:opacity-50"
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {photos.length === 0 ? "Ajouter des photos" : "Ajouter une photo"}
          </button>
        )}
        <p className="text-[11px] text-ink/45">
          JPG, PNG ou WebP — jusqu&apos;à {MAX_PHOTOS_PRODUIT} photos. La première est la photo
          principale ; réordonnez avec les flèches.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(event) => {
            const fichiers = Array.from(event.target.files ?? []);
            event.target.value = "";
            void choisirPhotos(fichiers);
          }}
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {!produit && (
        <p className="text-[11px] text-ink/45">
          Les variantes (Couleur, Taille…) et leurs stocks se configurent juste après, sur
          la fiche du produit.
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="self-start min-h-11 rounded-full bg-brand px-5 text-sm font-semibold text-surface transition-transform active:scale-95 disabled:opacity-50"
      >
        {submitting ? "Enregistrement…" : produit ? "Enregistrer" : "Créer le produit"}
      </button>
    </form>
  );
}
