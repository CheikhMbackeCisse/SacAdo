"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { texteNonVide } from "@/lib/admin/validation";
import { VENDEUR_SACADO_ID } from "@/lib/vendeurs/constants";
import type { Fournisseur } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

// Depuis l'unification vendeur = fournisseur (migration 0036), un « fournisseur »
// est un `vendeurs` sans compte (`user_id is null`) : une entité que l'admin gère
// à la main, avec son point de retrait de marchandise. Les vendeurs marketplace
// (avec compte) et le vendeur « SacAdo » ne figurent pas sur cet écran.

export type FournisseurInput = {
  nom: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
};

function estViolationUnicite(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function getFournisseurs(): Promise<Fournisseur[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("vendeurs")
    .select("id, nom_boutique, adresse, lat, lng")
    .is("user_id", null)
    .neq("id", VENDEUR_SACADO_ID)
    .eq("actif", true)
    .order("nom_boutique", { ascending: true });
  return ((data ?? []) as { id: string; nom_boutique: string; adresse: string | null; lat: number | null; lng: number | null }[]).map(
    (v) => ({ id: v.id, nom: v.nom_boutique, adresse: v.adresse, lat: v.lat, lng: v.lng }),
  );
}

function valider(input: FournisseurInput): string | null {
  if (!texteNonVide(input.nom, 120)) return "Le nom est requis.";
  if (input.adresse != null && input.adresse.length > 300) {
    return "L'adresse est trop longue (300 caractères maximum).";
  }
  const posPartielle = (input.lat == null) !== (input.lng == null);
  if (posPartielle) return "Position incomplète : place le point sur la carte.";
  if (input.lat != null && (Math.abs(input.lat) > 90 || Math.abs(input.lng ?? 0) > 180)) {
    return "Position invalide.";
  }
  return null;
}

function versColonnes(input: FournisseurInput) {
  return {
    nom_boutique: input.nom.trim(),
    adresse: input.adresse?.trim() || null,
    lat: input.lat,
    lng: input.lng,
  };
}

export async function creerFournisseur(input: FournisseurInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("vendeurs")
    .insert({ ...versColonnes(input), user_id: null });
  if (error) {
    if (estViolationUnicite(error)) return { ok: false, error: "Un fournisseur porte déjà ce nom." };
    return { ok: false, error: "Impossible d'enregistrer le fournisseur." };
  }
  return { ok: true };
}

export async function modifierFournisseur(id: string, input: FournisseurInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  // `user_id is null` : garde-fou, on ne modifie jamais un vendeur avec compte.
  const { error } = await supabaseAdmin
    .from("vendeurs")
    .update(versColonnes(input))
    .eq("id", id)
    .is("user_id", null);
  if (error) {
    if (estViolationUnicite(error)) return { ok: false, error: "Un fournisseur porte déjà ce nom." };
    return { ok: false, error: "Impossible de modifier le fournisseur." };
  }
  return { ok: true };
}

export async function supprimerFournisseur(id: string): Promise<ActionResult> {
  await requireAdmin();

  // `produits.vendeur_id` est en `on delete cascade` : supprimer un fournisseur
  // qui a des produits les effacerait en silence. On refuse dans ce cas.
  const { count } = await supabaseAdmin
    .from("produits")
    .select("id", { count: "exact", head: true })
    .eq("vendeur_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, error: "Impossible de supprimer : des produits sont rattachés à ce fournisseur." };
  }

  const { error } = await supabaseAdmin
    .from("vendeurs")
    .delete()
    .eq("id", id)
    .is("user_id", null);
  if (error) return { ok: false, error: "Suppression impossible." };
  return { ok: true };
}
