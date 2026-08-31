"use server";

import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SousCategorie } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

// Slug ASCII kebab-case dérivé du nom (accents retirés). Sert d'identifiant
// stable dans l'URL de filtre côté client (?sc=mathematiques).
const DIACRITIQUES = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

function slugify(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getSousCategoriesAdmin(): Promise<SousCategorie[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("sous_categories")
    .select("*")
    .order("categorie_id", { ascending: true })
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  return data ?? [];
}

export type SousCategorieInput = {
  nom: string;
  categorie_id: number;
  ordre: number;
};

function validerInput(input: SousCategorieInput): string | null {
  if (!texteNonVide(input.nom, 80)) return "Le nom est requis.";
  if (!Number.isInteger(input.categorie_id)) return "La catégorie est requise.";
  if (!slugify(input.nom)) return "Le nom doit contenir des lettres ou des chiffres.";
  return null;
}

export async function creerSousCategorie(
  input: SousCategorieInput,
): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const erreur = validerInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { data, error } = await supabaseAdmin
    .from("sous_categories")
    .insert({
      nom: input.nom.trim(),
      categorie_id: input.categorie_id,
      slug: slugify(input.nom),
      ordre: Number.isFinite(input.ordre) ? input.ordre : 0,
    })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: "Impossible de créer (une sous-catégorie de même nom existe déjà dans cette catégorie ?)." };
  }
  return { ok: true, id: data.id };
}

export async function modifierSousCategorie(
  id: number,
  input: SousCategorieInput,
): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("sous_categories")
    .update({
      nom: input.nom.trim(),
      categorie_id: input.categorie_id,
      slug: slugify(input.nom),
      ordre: Number.isFinite(input.ordre) ? input.ordre : 0,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "Impossible de modifier cette sous-catégorie." };
  return { ok: true };
}

export async function supprimerSousCategorie(id: number): Promise<ActionResult> {
  await requireAdmin();
  // Les produits rattachés repassent à sous_categorie_id = NULL (ON DELETE SET NULL).
  const { error } = await supabaseAdmin.from("sous_categories").delete().eq("id", id);
  if (error) return { ok: false, error: "Impossible de supprimer cette sous-catégorie." };
  return { ok: true };
}
