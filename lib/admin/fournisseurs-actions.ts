"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { estNombrePositifValide, texteNonVide } from "@/lib/admin/validation";
import { VENDEUR_SACADO_ID } from "@/lib/vendeurs/constants";
import type { Fournisseur, PalierTarif } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

// Depuis l'unification vendeur = fournisseur (migration 0036), un « fournisseur »
// est un `vendeurs` sans compte (`user_id is null`) : une entité que l'admin gère
// à la main, avec son point de retrait de marchandise, son contact et — depuis
// TACHE_seye_dynamique_integration.md — ses grilles de tarification par palier
// (migration 0070). Les vendeurs marketplace (avec compte) et le vendeur
// « SacAdo » ne figurent pas sur cet écran.

export type FournisseurInput = {
  nom: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  telephone: string | null;
  grilleRemise: PalierTarif[] | null;
  grilleMajoration: PalierTarif[] | null;
};

function estViolationUnicite(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

type VendeurRow = {
  id: string;
  nom_boutique: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  contact_telephone: string | null;
  grille_remise: PalierTarif[] | null;
  grille_majoration: PalierTarif[] | null;
};

function versFournisseur(v: VendeurRow): Fournisseur {
  return {
    id: v.id,
    nom: v.nom_boutique,
    adresse: v.adresse,
    lat: v.lat,
    lng: v.lng,
    telephone: v.contact_telephone,
    grilleRemise: v.grille_remise,
    grilleMajoration: v.grille_majoration,
  };
}

export async function getFournisseurs(): Promise<Fournisseur[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("vendeurs")
    .select("id, nom_boutique, adresse, lat, lng, contact_telephone, grille_remise, grille_majoration")
    .is("user_id", null)
    .neq("id", VENDEUR_SACADO_ID)
    .eq("actif", true)
    .order("nom_boutique", { ascending: true });
  return ((data ?? []) as VendeurRow[]).map(versFournisseur);
}

// Une grille est valide si absente, ou si ses seuils forment une suite
// strictement croissante se terminant par `null` (dernier palier, illimité)
// et si toutes les valeurs sont positives. C'est la même forme pour la
// remise et la majoration.
function grilleValide(grille: PalierTarif[] | null): boolean {
  if (grille === null) return true;
  if (grille.length === 0) return false;
  for (let i = 0; i < grille.length; i++) {
    const palier = grille[i];
    const dernier = i === grille.length - 1;
    if (!estNombrePositifValide(palier.valeur)) return false;
    if (dernier) {
      if (palier.seuil !== null) return false;
    } else {
      if (typeof palier.seuil !== "number" || !Number.isFinite(palier.seuil)) return false;
      const precedent = grille[i - 1];
      if (i > 0 && precedent.seuil !== null && palier.seuil <= precedent.seuil) return false;
    }
  }
  return true;
}

function valider(input: FournisseurInput): string | null {
  if (!texteNonVide(input.nom, 120)) return "Le nom est requis.";
  if (input.adresse != null && input.adresse.length > 300) {
    return "L'adresse est trop longue (300 caractères maximum).";
  }
  if (input.telephone != null && input.telephone.length > 40) {
    return "Le téléphone est trop long (40 caractères maximum).";
  }
  const posPartielle = (input.lat == null) !== (input.lng == null);
  if (posPartielle) return "Position incomplète : place le point sur la carte.";
  if (input.lat != null && (Math.abs(input.lat) > 90 || Math.abs(input.lng ?? 0) > 180)) {
    return "Position invalide.";
  }
  if (!grilleValide(input.grilleRemise)) return "Grille de remise invalide : seuils croissants, dernier palier illimité.";
  if (!grilleValide(input.grilleMajoration)) return "Grille de majoration invalide : seuils croissants, dernier palier illimité.";
  return null;
}

function versColonnes(input: FournisseurInput) {
  return {
    nom_boutique: input.nom.trim(),
    adresse: input.adresse?.trim() || null,
    lat: input.lat,
    lng: input.lng,
    contact_telephone: input.telephone?.trim() || null,
    grille_remise: input.grilleRemise,
    grille_majoration: input.grilleMajoration,
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
