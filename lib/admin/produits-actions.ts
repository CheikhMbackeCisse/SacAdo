"use server";

import { requireAdmin } from "./guard";
import { estNombrePositifValide, texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Delai, Produit, ProduitVariante, StatutProduit } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type PageAdmin<T> = { items: T[]; hasMore: boolean };

const TAILLE_PAGE_ADMIN = 50;

// Liste complète : utilisée pour le sélecteur "ajouter un article" d'un kit,
// où on a besoin de chercher parmi tous les produits. À revoir si le
// catalogue grossit beaucoup (passer à une recherche paginée côté serveur).
export async function getProduitsAdmin(): Promise<Produit[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("produits").select("*").order("nom", { ascending: true });
  return data ?? [];
}

// Liste paginée : utilisée par l'écran /admin/produits pour ne pas charger
// tout le catalogue d'un coup quand il grossit.
export async function getProduitsAdminPage(
  { offset = 0, limit = TAILLE_PAGE_ADMIN }: { offset?: number; limit?: number } = {},
): Promise<PageAdmin<Produit>> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("produits")
    .select("*")
    .order("nom", { ascending: true })
    .range(offset, offset + limit);
  const rows = data ?? [];
  const hasMore = rows.length > limit;
  return { items: hasMore ? rows.slice(0, limit) : rows, hasMore };
}

export async function getProduitAdmin(id: number): Promise<Produit | null> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("produits").select("*").eq("id", id).maybeSingle();
  return data;
}

export type ProduitInput = {
  nom: string;
  categorie: string;
  prix: number;
  delai: Delai;
  photo: string | null;
  stock: number;
  seuil_alerte: number;
  statut: StatutProduit;
};

function validerProduitInput(input: ProduitInput): string | null {
  if (!texteNonVide(input.nom, 200)) return "Le nom est requis.";
  if (!texteNonVide(input.categorie, 100)) return "La catégorie est requise.";
  if (!estNombrePositifValide(input.prix)) return "Le prix doit être un nombre positif.";
  if (!estNombrePositifValide(input.stock)) return "Le stock doit être un nombre positif.";
  if (!estNombrePositifValide(input.seuil_alerte)) return "Le seuil d'alerte doit être un nombre positif.";
  return null;
}

export async function creerProduit(input: ProduitInput): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const erreur = validerProduitInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { data, error } = await supabaseAdmin.from("produits").insert(input).select().single();
  if (error || !data) return { ok: false, error: "Impossible de créer le produit." };
  return { ok: true, id: data.id };
}

export async function modifierProduit(id: number, input: ProduitInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerProduitInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("produits").update(input).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier le produit." };
  return { ok: true };
}

export async function supprimerProduit(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("produits").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: "Impossible de supprimer : ce produit est utilisé dans une commande ou un kit.",
    };
  }
  return { ok: true };
}

export async function getVariantesAdmin(produitId: number): Promise<ProduitVariante[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("produit_variantes")
    .select("*")
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  return data ?? [];
}

export type VarianteInput = {
  couleur: string | null;
  taille: string | null;
  prix: number | null;
  stock: number;
  photo: string | null;
};

function validerVarianteInput(input: VarianteInput): string | null {
  if (!input.couleur && !input.taille) return "Renseigne une couleur ou une taille.";
  if (!estNombrePositifValide(input.stock)) return "Le stock doit être un nombre positif.";
  if (input.prix !== null && !estNombrePositifValide(input.prix)) return "Le prix doit être un nombre positif.";
  return null;
}

export async function creerVariante(produitId: number, input: VarianteInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerVarianteInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("produit_variantes")
    .insert({ produit_id: produitId, ...input });
  if (error) return { ok: false, error: "Impossible de créer la variante." };
  return { ok: true };
}

export async function modifierVariante(id: number, input: VarianteInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerVarianteInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("produit_variantes").update(input).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier la variante." };
  return { ok: true };
}

export async function supprimerVariante(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("produit_variantes").delete().eq("id", id);
  if (error) {
    return { ok: false, error: "Impossible de supprimer : cette variante est référencée par une commande." };
  }
  return { ok: true };
}
