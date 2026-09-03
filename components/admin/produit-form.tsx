"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { creerProduit, modifierProduit, type ProduitInput } from "@/lib/admin/produits-actions";
import { creerSousCategorie } from "@/lib/admin/sous-categories-actions";
import { ChampSelect } from "@/components/ui/champ-select";
import type { Categorie, Produit, SousCategorie } from "@/lib/supabase/types";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

type Props = {
  produit?: Produit;
  categories: Categorie[];
  sousCategories: SousCategorie[];
};

export function ProduitForm({ produit, categories, sousCategories }: Props) {
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
  const [prix, setPrix] = useState(produit?.prix?.toString() ?? "");
  const [delai, setDelai] = useState<ProduitInput["delai"] | "">(produit?.delai ?? "");
  const [photo, setPhoto] = useState(produit?.photo ?? "");
  const [stock, setStock] = useState(produit?.stock?.toString() ?? "0");
  const [seuilAlerte, setSeuilAlerte] = useState(produit?.seuil_alerte?.toString() ?? "5");
  const [statut, setStatut] = useState<ProduitInput["statut"]>(produit?.statut ?? "dispo");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sous-catégories créées à la volée depuis ce formulaire, fusionnées à la liste.
  const [sousCatsAjoutees, setSousCatsAjoutees] = useState<SousCategorie[]>([]);
  const [nouvelleSousCat, setNouvelleSousCat] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);

  const toutesSousCats = useMemo(
    () => [...sousCategories, ...sousCatsAjoutees],
    [sousCategories, sousCatsAjoutees],
  );

  const sousCatsDeLaCategorie = useMemo(
    () =>
      toutesSousCats
        .filter((sc) => sc.categorie_id === categorieId)
        .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom)),
    [toutesSousCats, categorieId],
  );

  const sousCategorieRequise = categorieId !== "" && sousCatsDeLaCategorie.length > 0;

  const changerCategorie = (valeur: number | "") => {
    setCategorieId(valeur);
    const encoreValide = toutesSousCats.some(
      (sc) => sc.id === sousCategorieId && sc.categorie_id === valeur,
    );
    if (!encoreValide) setSousCategorieId(null);
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
      setError("Veuillez choisir un délai.");
      return;
    }

    setSubmitting(true);

    const input: ProduitInput = {
      nom: nom.trim(),
      categorie_id: categorieId,
      sous_categorie_id: sousCategorieId,
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
              { value: "6j", label: "6 jours" },
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
          onChange={(v) => setSousCategorieId(v ? Number(v) : null)}
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
          Repasse automatiquement à « épuisé » si le stock tombe à 0.
        </span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Photo (chemin, ex: /images/prod-x.jpg)</span>
        <input
          value={photo}
          onChange={(event) => setPhoto(event.target.value)}
          className="min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </label>

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
