"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { texteNonVide } from "@/lib/admin/validation";
import type { Fournisseur } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

export type FournisseurInput = {
  nom: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
};

export async function getFournisseurs(): Promise<Fournisseur[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("fournisseurs")
    .select("*")
    .order("nom", { ascending: true });
  return (data ?? []) as Fournisseur[];
}

function valider(input: FournisseurInput): string | null {
  if (!texteNonVide(input.nom, 120)) return "Le nom est requis.";
  const posPartielle =
    (input.lat == null) !== (input.lng == null);
  if (posPartielle) return "Position incomplète : place le point sur la carte.";
  if (input.lat != null && (Math.abs(input.lat) > 90 || Math.abs(input.lng ?? 0) > 180)) {
    return "Position invalide.";
  }
  return null;
}

function versColonnes(input: FournisseurInput) {
  return {
    nom: input.nom.trim(),
    adresse: input.adresse?.trim() || null,
    lat: input.lat,
    lng: input.lng,
  };
}

export async function creerFournisseur(input: FournisseurInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("fournisseurs").insert(versColonnes(input));
  if (error) return { ok: false, error: "Impossible d'enregistrer le fournisseur." };
  return { ok: true };
}

export async function modifierFournisseur(
  id: number,
  input: FournisseurInput,
): Promise<ActionResult> {
  await requireAdmin();
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("fournisseurs")
    .update(versColonnes(input))
    .eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier le fournisseur." };
  return { ok: true };
}

export async function supprimerFournisseur(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("fournisseurs").delete().eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  return { ok: true };
}
