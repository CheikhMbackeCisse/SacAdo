import { supabase } from "./client";
import { GAMME_ORDER } from "@/lib/gammes";
import { aplatirAttributs } from "@/lib/variantes";
import type {
  Categorie,
  Gamme,
  Kit,
  Localite,
  LieuSpecial,
  Produit,
  SousCategorie,
  SousSousCategorie,
  VarianteAvecAttributs,
  Zone,
} from "./types";

const SELECT_VARIANTE = "*, variante_attributs(attribut_id, valeur, attributs(nom))";

// Colonnes produit exposées au storefront (client anon). Toutes SAUF
// `prix_achat` : le coût d'achat ne doit jamais transiter par l'API publique
// (il n'existe que pour la composante « marge » du score, calculée en base).
// L'admin lit l'intégralité via le service_role.
const COLONNES_PRODUIT_PUBLIC =
  "id,nom,categorie_id,sous_categorie_id,sous_sous_categorie_id,prix,delai,photo,photos,stock,seuil_alerte,statut,created_at,description,mots_cles,vendeur_id,statut_publication,motif_refus,commentaire_vendeur,publie_par,niveau,serie,matiere,type_ouvrage,auteur,editeur,edition,edition_statut,couverture_epreuves,ouvrage_id" as const;

// Aplatit une réponse Supabase (avec ou sans jointure) en VarianteAvecAttributs.
function versVariantes(
  rows: unknown[] | null,
  avecJointure: boolean,
): VarianteAvecAttributs[] {
  return (rows ?? []).map((row) => ({
    ...(row as VarianteAvecAttributs),
    attributs: avecJointure ? aplatirAttributs(row as never) : [],
  }));
}

export async function getCategories(): Promise<Categorie[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("actif", true)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getCategorieBySlug(slug: string): Promise<Categorie | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCategorieById(id: number): Promise<Categorie | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPopulaires(limit = 8): Promise<Produit[]> {
  const { data, error } = await supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .or(FILTRE_EDITION_AFFICHABLE)
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// L'accueil classé (getAccueilProduits) vit dans lib/accueil.ts : il lit
// l'affinité de la personne via le service_role, ce que ce fichier — importé
// par des composants client — ne peut pas faire.

export type PageResultat<T> = { items: T[]; hasMore: boolean };

export const TAILLE_PAGE_CATALOGUE = 24;

export async function getProduitsByCategorie(
  categorieId: number,
  {
    offset = 0,
    limit = TAILLE_PAGE_CATALOGUE,
    sousCategorieId,
    sousSousCategorieId,
  }: {
    offset?: number;
    limit?: number;
    sousCategorieId?: number | null;
    sousSousCategorieId?: number | null;
  } = {},
): Promise<PageResultat<Produit>> {
  // .range() est inclusif : on demande une ligne de plus que "limit" pour
  // savoir s'il reste une page suivante, sans requête de comptage séparée.
  let requete = supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .eq("categorie_id", categorieId)
    .or(FILTRE_EDITION_AFFICHABLE);
  if (sousCategorieId != null) requete = requete.eq("sous_categorie_id", sousCategorieId);
  if (sousSousCategorieId != null) {
    requete = requete.eq("sous_sous_categorie_id", sousSousCategorieId);
  }

  const { data, error } = await requete
    .order("nom", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

export async function getSousCategoriesByCategorie(
  categorieId: number,
): Promise<SousCategorie[]> {
  const { data, error } = await supabase
    .from("sous_categories")
    .select("*")
    .eq("categorie_id", categorieId)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) {
    console.warn("sous_categories indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

// 3e niveau (optionnel). Renvoie [] si la sous-catégorie n'en a pas — c'est le
// signal que le formulaire produit n'affiche pas le 3e select (SOUS_SOUS_CATEGORIES.md §2).
// `console.warn` + [] tant que la migration 0030 n'est pas passée.
export async function getSousSousCategoriesBySousCategorie(
  sousCategorieId: number,
): Promise<SousSousCategorie[]> {
  const { data, error } = await supabase
    .from("sous_sous_categories")
    .select("*")
    .eq("sous_categorie_id", sousCategorieId)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) {
    console.warn("sous_sous_categories indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

export async function getProduitById(id: number): Promise<Produit | null> {
  const { data, error } = await supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Livres et annales (migration 0068, §3.4) : les autres éditions publiées du
// même ouvrage, pour le bloc "Autres éditions disponibles" de la fiche produit.
export type EditionSoeur = Pick<Produit, "id" | "prix" | "edition" | "couverture_epreuves">;

export async function getAutresEditions(
  ouvrageId: number,
  produitIdActuel: number,
): Promise<EditionSoeur[]> {
  const { data, error } = await supabase
    .from("produits")
    .select("id, prix, edition, couverture_epreuves")
    .eq("ouvrage_id", ouvrageId)
    .eq("statut_publication", "publie")
    .neq("id", produitIdActuel);
  if (error) throw error;
  return data ?? [];
}

export async function getProduitsByIds(ids: number[]): Promise<Produit[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function getVariantesByProduit(
  produitId: number,
): Promise<VarianteAvecAttributs[]> {
  const jointure = await supabase
    .from("produit_variantes")
    .select(SELECT_VARIANTE)
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  if (!jointure.error) return versVariantes(jointure.data, true);

  // Repli si `variante_attributs` n'existe pas encore (migration 0022).
  const brut = await supabase
    .from("produit_variantes")
    .select("*")
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  if (brut.error) throw brut.error;
  return versVariantes(brut.data, false);
}

export async function getVariantesByIds(ids: number[]): Promise<VarianteAvecAttributs[]> {
  if (ids.length === 0) return [];
  const jointure = await supabase
    .from("produit_variantes")
    .select(SELECT_VARIANTE)
    .in("id", ids);
  if (!jointure.error) return versVariantes(jointure.data, true);

  const brut = await supabase.from("produit_variantes").select("*").in("id", ids);
  if (brut.error) throw brut.error;
  return versVariantes(brut.data, false);
}

export async function getZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from("zones").select("*").order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Sert à peupler le sélecteur de localité du checkout (IMPLEMENTATION_TARIFS_LIVRAISON.md).
// Tolère la table absente (migration 0034 pas encore passée) : le checkout
// retombe alors sur la saisie libre "tarif à confirmer".
export async function getLocalites(): Promise<Localite[]> {
  const { data, error } = await supabase.from("localites").select("*").order("nom", { ascending: true });
  if (error) {
    console.warn("localites indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

export async function getLieuxSpeciaux(): Promise<LieuSpecial[]> {
  const { data, error } = await supabase.from("lieux_speciaux").select("*").order("nom", { ascending: true });
  if (error) {
    console.warn("lieux_speciaux indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

const SEUIL_LIVRAISON_GRATUITE_DEFAUT = 75000;

// Réglable en admin (table `parametres`) : repli sur la valeur par défaut si
// la ligne n'existe pas encore ou si elle est mal formée.
export async function getSeuilLivraisonGratuite(): Promise<number> {
  const { data, error } = await supabase
    .from("parametres")
    .select("valeur")
    .eq("cle", "seuil_livraison_gratuite")
    .maybeSingle();
  if (error || !data) return SEUIL_LIVRAISON_GRATUITE_DEFAUT;
  const valeur = Number(data.valeur);
  return Number.isFinite(valeur) && valeur >= 0 ? valeur : SEUIL_LIVRAISON_GRATUITE_DEFAUT;
}

export async function getProduitsSimilaires(
  categorieId: number,
  excludeId: number,
  limit = 4,
): Promise<Produit[]> {
  const { data, error } = await supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .eq("categorie_id", categorieId)
    .neq("id", excludeId)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Sacs proposés dans le sélecteur du kit (KIT_AMELIORATIONS.md §3) : les
// sous-catégories "Sacs à dos" et "Sacs à roulettes" de "Cartables & sacs".
// Pas de cartables ici : le kit propose un SAC, distinct du cartable rigide.
const SLUGS_SOUS_CATEGORIES_SACS = ["sacs-a-dos", "sacs-a-roulettes"];

export async function getSacsDisponibles({
  offset = 0,
  limit = 5,
  excludeIds = [],
}: {
  offset?: number;
  limit?: number;
  excludeIds?: number[];
} = {}): Promise<PageResultat<Produit>> {
  const { data: sousCats, error: erreurSousCats } = await supabase
    .from("sous_categories")
    .select("id")
    .in("slug", SLUGS_SOUS_CATEGORIES_SACS);
  if (erreurSousCats) throw erreurSousCats;
  const sousCategorieIds = (sousCats ?? []).map((row) => row.id as number);
  if (sousCategorieIds.length === 0) return { items: [], hasMore: false };

  let requete = supabase
    .from("produits")
    .select(COLONNES_PRODUIT_PUBLIC)
    .in("sous_categorie_id", sousCategorieIds)
    .or(FILTRE_EDITION_AFFICHABLE);
  if (excludeIds.length > 0) requete = requete.not("id", "in", `(${excludeIds.join(",")})`);

  const { data, error } = await requete
    .order("nom", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

// Recherche produit v2 (migration 0041) : chaque mot tapé est obligatoire (ET),
// synonymes pris en compte, et chaque résultat est classé `nom` (la désignation
// contient les mots tapés) ou `categorie` (match seulement via la catégorie).
export type TypeResultat = "nom" | "categorie";
export type ProduitTrouve = Produit & { type_resultat: TypeResultat };

type LigneRechercheRpc = { id: number; type_resultat: TypeResultat; score: number };

export async function rechercherProduits(
  query: string,
  { limite = TAILLE_PAGE_CATALOGUE }: { limite?: number } = {},
): Promise<ProduitTrouve[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase.rpc("rechercher_produits", {
    terme: trimmed,
    limite,
  });

  if (error) {
    // Repli tant que la migration 0041 n'est pas passée : ilike simple sur le nom.
    console.warn("rechercher_produits indisponible, repli ilike :", error.message);
    const repli = await supabase
      .from("produits")
      .select(COLONNES_PRODUIT_PUBLIC)
      .ilike("nom", `%${trimmed}%`)
      .order("nom", { ascending: true })
      .limit(limite);
    if (repli.error) throw repli.error;
    return (repli.data ?? []).map((p) => ({
      ...(p as Produit),
      type_resultat: "nom" as const,
    }));
  }

  const lignes = (data ?? []) as LigneRechercheRpc[];
  if (lignes.length === 0) return [];

  // La RPC ne renvoie qu'un sous-ensemble de colonnes : on ré-hydrate en Produit
  // complet (badge de délai, variantes, etc.) en préservant l'ordre du score.
  const produits = await getProduitsByIds(lignes.map((l) => l.id));
  const parId = new Map(produits.map((p) => [p.id, p]));
  return lignes
    .map((l) => {
      const p = parId.get(l.id);
      return p ? { ...p, type_resultat: l.type_resultat } : null;
    })
    .filter((p): p is ProduitTrouve => p !== null)
    .filter(estEditionAffichable);
}

// Livres et annales (migration 0068, §3.5.1) : une ancienne édition ne
// s'affiche jamais dans les listes/la recherche tant que son édition en
// vigueur existe (`ouvrage_id` partagé). Un produit sans `ouvrage_id` n'a
// pas de frère : toujours affiché.
//
// Filtre appliqué CÔTÉ REQUÊTE (PostgREST .or()) sur les listes paginées par
// `.range()` : le filtrer après coup en JS fausse `hasMore` (une page où la
// ligne exclue tombait dans la fenêtre récupérée se retrouvait avec moins de
// lignes que prévu, donnant l'impression à tort qu'il n'y avait pas de page
// suivante — des dizaines de produits devenaient alors invisibles).
const FILTRE_EDITION_AFFICHABLE = "edition_statut.neq.ancienne,ouvrage_id.is.null";

function estEditionAffichable(p: Produit): boolean {
  return !(p.edition_statut === "ancienne" && p.ouvrage_id !== null);
}

export type SuggestionProduit = Pick<Produit, "id" | "nom" | "photo" | "prix" | "statut">;
export type SuggestionCategorie = Pick<Categorie, "id" | "nom" | "slug">;
export type SuggestionSousCategorie = Pick<SousCategorie, "id" | "nom" | "slug"> & {
  categorie_slug: string;
  categorie_nom: string;
};
// 3e niveau (SOUS_SOUS_CATEGORIES.md §3) : porte aussi le chemin complet
// (slugs + noms de la catégorie et de la sous-catégorie parentes), nécessaire
// pour construire le lien /categorie/[slug]?sc=...&ssc=... et le sous-titre.
export type SuggestionSousSousCategorie = Pick<SousSousCategorie, "id" | "nom" | "slug"> & {
  sous_categorie_slug: string;
  sous_categorie_nom: string;
  categorie_slug: string;
  categorie_nom: string;
};
export type SuggestionsRecherche = {
  produits: SuggestionProduit[];
  categories: SuggestionCategorie[];
  sousCategories: SuggestionSousCategorie[];
  sousSousCategories: SuggestionSousSousCategorie[];
};

const SUGGESTIONS_VIDES: SuggestionsRecherche = {
  produits: [],
  categories: [],
  sousCategories: [],
  sousSousCategories: [],
};

export async function getSuggestionsRecherche(query: string): Promise<SuggestionsRecherche> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return SUGGESTIONS_VIDES;
  const { data, error } = await supabase.rpc("suggestions_recherche", { p_terme: trimmed });
  if (error) {
    console.warn("suggestions_recherche indisponible :", error.message);
    return SUGGESTIONS_VIDES;
  }
  const brut = (data ?? {}) as {
    produits?: SuggestionProduit[];
    categories?: SuggestionCategorie[];
    sous_categories?: SuggestionSousCategorie[];
    sous_sous_categories?: SuggestionSousSousCategorie[];
  };
  return {
    produits: brut.produits ?? [],
    categories: brut.categories ?? [],
    sousCategories: brut.sous_categories ?? [],
    sousSousCategories: brut.sous_sous_categories ?? [],
  };
}

// Toutes les sous-sous-catégories des sous-catégories données (utilisé par la
// page catégorie : elle connaît déjà ses sous-catégories, on récupère leur
// éventuel 3e niveau en un seul aller-retour). Tolère la table absente.
export async function getSousSousCategoriesBySousCategories(
  sousCategorieIds: number[],
): Promise<SousSousCategorie[]> {
  if (sousCategorieIds.length === 0) return [];
  const { data, error } = await supabase
    .from("sous_sous_categories")
    .select("*")
    .in("sous_categorie_id", sousCategorieIds)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error) {
    console.warn("sous_sous_categories indisponible :", error.message);
    return [];
  }
  return data ?? [];
}

// Les gammes disponibles pour une classe, triées Essentiel -> Confort -> Complet.
export async function getKitsByCycleNiveau(cycle: string, niveau: string): Promise<Kit[]> {
  const { data, error } = await supabase
    .from("kits")
    .select("*")
    .eq("cycle", cycle)
    .eq("niveau", niveau);
  if (error) throw error;
  return (data ?? []).sort((a, b) => GAMME_ORDER[a.gamme as Gamme] - GAMME_ORDER[b.gamme as Gamme]);
}

export async function getKitByCycleNiveauGamme(
  cycle: string,
  niveau: string,
  gamme: Gamme,
): Promise<Kit | null> {
  const { data, error } = await supabase
    .from("kits")
    .select("*")
    .eq("cycle", cycle)
    .eq("niveau", niveau)
    .eq("gamme", gamme)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type KitItemAvecProduit = {
  id: number;
  quantite_defaut: number;
  produit: Produit;
};

export async function getKitItemsAvecProduits(kitId: number): Promise<KitItemAvecProduit[]> {
  const { data, error } = await supabase
    .from("kit_items")
    .select("id, quantite_defaut, produit:produits(*)")
    .eq("kit_id", kitId);
  if (error) throw error;

  // Sans schéma Database généré, supabase-js ne connaît pas la cardinalité de
  // la relation embarquée (produits ↔ kit_items) et type "produit" en any[] :
  // on gère les deux formes possibles au runtime plutôt que de forcer un cast.
  type RawRow = { id: number; quantite_defaut: number; produit: Produit | Produit[] | null };
  const rows = (data ?? []) as unknown as RawRow[];

  return rows
    .map((row) => {
      const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
      return produit ? { id: row.id, quantite_defaut: row.quantite_defaut, produit } : null;
    })
    .filter((row): row is KitItemAvecProduit => row !== null);
}
