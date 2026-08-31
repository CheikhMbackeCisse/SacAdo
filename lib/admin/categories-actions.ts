"use server";

import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Categorie } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

const DIACRITIQUES = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

function slugify(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(DIACRITIQUES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getCategoriesAdmin(): Promise<Categorie[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("categories")
    .select("*")
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });
  return data ?? [];
}

export type CategorieInput = {
  nom: string;
  ordre: number;
  image: string | null;
  actif: boolean;
};

function validerInput(input: CategorieInput): string | null {
  if (!texteNonVide(input.nom, 80)) return "Le nom est requis.";
  if (!slugify(input.nom)) return "Le nom doit contenir des lettres ou des chiffres.";
  return null;
}

export async function creerCategorie(
  input: CategorieInput,
): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const erreur = validerInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { data, error } = await supabaseAdmin
    .from("categories")
    .insert({
      nom: input.nom.trim(),
      slug: slugify(input.nom),
      ordre: Number.isFinite(input.ordre) ? input.ordre : 0,
      image: input.image?.trim() || null,
      actif: input.actif,
    })
    .select()
    .single();

  if (error || !data) {
    return { ok: false, error: "Impossible de créer (une catégorie de même nom existe déjà ?)." };
  }
  return { ok: true, id: data.id };
}

export async function modifierCategorie(
  id: number,
  input: CategorieInput,
): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("categories")
    .update({
      nom: input.nom.trim(),
      slug: slugify(input.nom),
      ordre: Number.isFinite(input.ordre) ? input.ordre : 0,
      image: input.image?.trim() || null,
      actif: input.actif,
    })
    .eq("id", id);

  if (error) return { ok: false, error: "Impossible de modifier cette catégorie." };
  return { ok: true };
}

export async function supprimerCategorie(id: number): Promise<ActionResult> {
  await requireAdmin();
  // FK produits.categorie_id ON DELETE RESTRICT : la suppression échoue si des
  // produits sont encore rattachés. Les sous-catégories, elles, sont supprimées
  // en cascade (ON DELETE CASCADE).
  const { error } = await supabaseAdmin.from("categories").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: "Impossible de supprimer : des produits sont encore dans cette catégorie.",
    };
  }
  return { ok: true };
}
