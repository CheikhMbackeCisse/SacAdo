import { supabase } from "./client";
import type { Kit, Produit, ProduitVariante, Zone } from "./types";

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
  categorie: string,
  { offset = 0, limit = TAILLE_PAGE_CATALOGUE }: { offset?: number; limit?: number } = {},
): Promise<PageResultat<Produit>> {
  // .range() est inclusif : on demande une ligne de plus que "limit" pour
  // savoir s'il reste une page suivante, sans requête de comptage séparée.
  const { data, error } = await supabase
    .from("produits")
    .select("*")
    .eq("categorie", categorie)
    .order("nom", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
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

export async function getVariantesByProduit(produitId: number): Promise<ProduitVariante[]> {
  const { data, error } = await supabase
    .from("produit_variantes")
    .select("*")
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getVariantesByIds(ids: number[]): Promise<ProduitVariante[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("produit_variantes").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function getZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from("zones").select("*").order("id", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getProduitsSimilaires(
  categorie: string,
  excludeId: number,
  limit = 4,
): Promise<Produit[]> {
  const { data, error } = await supabase
    .from("produits")
    .select("*")
    .eq("categorie", categorie)
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
  const { data, error } = await supabase
    .from("produits")
    .select("*")
    .ilike("nom", `%${trimmed}%`)
    .order("nom", { ascending: true })
    .range(offset, offset + limit);
  if (error) throw error;
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

export async function getKitByCycleNiveau(cycle: string, niveau: string): Promise<Kit | null> {
  const { data, error } = await supabase
    .from("kits")
    .select("*")
    .eq("cycle", cycle)
    .eq("niveau", niveau)
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
