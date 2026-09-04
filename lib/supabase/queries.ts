import { supabase } from "./client";
import { GAMME_ORDER } from "@/lib/gammes";
import { aplatirAttributs } from "@/lib/variantes";
import type {
  Categorie,
  Gamme,
  Kit,
  Produit,
  SousCategorie,
  SousSousCategorie,
  VarianteAvecAttributs,
  Zone,
} from "./types";

const SELECT_VARIANTE = "*, variante_attributs(attribut_id, valeur, attributs(nom))";

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
    .select("*")
    .order("id", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

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
  let requete = supabase.from("produits").select("*").eq("categorie_id", categorieId);
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
  const { data, error } = await supabase.from("produits").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProduitsByIds(ids: number[]): Promise<Produit[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("produits").select("*").in("id", ids);
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

export async function getProduitsSimilaires(
  categorieId: number,
  excludeId: number,
  limit = 4,
): Promise<Produit[]> {
  const { data, error } = await supabase
    .from("produits")
    .select("*")
    .eq("categorie_id", categorieId)
    .neq("id", excludeId)
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function searchProduits(
  query: string,
  { offset = 0, limit = TAILLE_PAGE_CATALOGUE }: { offset?: number; limit?: number } = {},
): Promise<PageResultat<Produit>> {
  const trimmed = query.trim();
  if (!trimmed) return { items: [], hasMore: false };
  // RPC tolérante aux fautes (word_similarity pg_trgm) — voir migration 0010.
  // On demande une ligne de plus que "limit" pour détecter la page suivante.
  const { data, error } = await supabase.rpc("rechercher_produits", {
    p_terme: trimmed,
    p_offset: offset,
    p_limit: limit + 1,
  });
  if (error) {
    // Repli sur une recherche simple tant que la migration 0010 n'est pas passée.
    console.warn("rechercher_produits indisponible, repli ilike :", error.message);
    const repli = await supabase
      .from("produits")
      .select("*")
      .ilike("nom", `%${trimmed}%`)
      .order("nom", { ascending: true })
      .range(offset, offset + limit);
    if (repli.error) throw repli.error;
    const lignes = repli.data ?? [];
    const encore = lignes.length > limit;
    return { items: encore ? lignes.slice(0, limit) : lignes, hasMore: encore };
  }
  const rows = (data ?? []) as Produit[];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
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
