"use server";

import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SousSousCategorie } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

// 3e niveau, optionnel (SOUS_SOUS_CATEGORIES.md) : n'existe que pour les
// sous-catégories où c'est pertinent. Calqué sur sous-categories-actions.ts.
// Création réservée à l'admin ; les vendeurs choisissent parmi l'existant.
const DIACRITIQUES = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

function slugify(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Postgres 42P01 = « relation does not exist » : la migration 0030 n'est pas
// encore passée. On tolère (liste vide) plutôt que de casser l'écran admin.
const TABLE_ABSENTE = "42P01";

export async function getSousSousCategoriesAdmin(): Promise<SousSousCategorie[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("sous_sous_categories")
    .select("*")
    .order("sous_categorie_id", { ascending: true })
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  if (error && error.code !== TABLE_ABSENTE) {
    console.warn("sous_sous_categories indisponible :", error.message);
  }
  return data ?? [];
}

export type SousSousCategorieInput = {
  nom: string;
  sous_categorie_id: number;
  ordre: number;
};

function validerInput(input: SousSousCategorieInput): string | null {
  if (!texteNonVide(input.nom, 80)) return "Le nom est requis.";
  if (!Number.isInteger(input.sous_categorie_id)) return "La sous-catégorie est requise.";
  if (!slugify(input.nom)) return "Le nom doit contenir des lettres ou des chiffres.";
  return null;
}

export async function creerSousSousCategorie(
  input: SousSousCategorieInput,
): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const erreur = validerInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { data, error } = await supabaseAdmin
    .from("sous_sous_categories")
    .insert({
      nom: input.nom.trim(),
      sous_categorie_id: input.sous_categorie_id,
      slug: slugify(input.nom),
      ordre: Number.isFinite(input.ordre) ? input.ordre : 0,
    })
    .select()
    .single();

  if (error || !data) {
    return {
      ok: false,
      error:
        "Impossible de créer (une sous-sous-catégorie de même nom existe déjà dans cette sous-catégorie ?).",
    };
  }
  return { ok: true, id: data.id };
}

export async function modifierSousSousCategorie(
  id: number,
  input: SousSousCategorieInput,
): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("sous_sous_categories")
    .update({
      nom: input.nom.trim(),
      sous_categorie_id: input.sous_categorie_id,
      slug: slugify(input.nom),
      ordre: Number.isFinite(input.ordre) ? input.ordre : 0,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "Impossible de modifier cette sous-sous-catégorie." };
  return { ok: true };
}

export async function supprimerSousSousCategorie(id: number): Promise<ActionResult> {
  await requireAdmin();
  // Les produits rattachés repassent à sous_sous_categorie_id = NULL (ON DELETE SET NULL).
  const { error } = await supabaseAdmin.from("sous_sous_categories").delete().eq("id", id);
  if (error) return { ok: false, error: "Impossible de supprimer cette sous-sous-catégorie." };
  return { ok: true };
}
