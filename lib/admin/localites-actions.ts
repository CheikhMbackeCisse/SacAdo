"use server";

import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Localite } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

export async function getLocalitesAdmin(): Promise<Localite[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("localites").select("*").order("nom", { ascending: true });
  return (data ?? []) as Localite[];
}

export type LocaliteInput = {
  nom: string;
  groupeId: number;
  lat: number | null;
  lng: number | null;
};

function validerLocaliteInput(input: LocaliteInput): string | null {
  if (!texteNonVide(input.nom, 100)) return "Le nom de la localité est requis.";
  if (!Number.isFinite(input.groupeId)) return "Choisis un groupe de livraison.";
  const posPartielle = (input.lat == null) !== (input.lng == null);
  if (posPartielle) return "Position incomplète : place le point sur la carte.";
  if (input.lat != null && (Math.abs(input.lat) > 90 || Math.abs(input.lng ?? 0) > 180)) {
    return "Position invalide.";
  }
  return null;
}

function versColonnes(input: LocaliteInput) {
  return {
    nom: input.nom.trim(),
    groupe_id: input.groupeId,
    lat: input.lat,
    lng: input.lng,
  };
}

export async function creerLocalite(input: LocaliteInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerLocaliteInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("localites").insert(versColonnes(input));
  if (error) return { ok: false, error: "Impossible de créer cette localité (nom déjà utilisé ?)." };
  return { ok: true };
}

export async function modifierLocalite(id: number, input: LocaliteInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerLocaliteInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("localites").update(versColonnes(input)).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier cette localité." };
  return { ok: true };
}

export async function supprimerLocalite(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("localites").delete().eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  return { ok: true };
}

// ============================================================================
// Page « Localités sur la carte » (PROMPT_ADMIN_COMPTA_LOCALITES.md Lot 2 §3)
// ============================================================================

const RAYON_MIN_KM = 0.5;
const RAYON_MAX_KM = 30;

function positionValide(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Déplacement du point par glisser-déposer ou clic sur la carte.
export async function deplacerLocalite(id: number, lat: number, lng: number): Promise<ActionResult> {
  await requireAdmin();
  if (!positionValide(lat, lng)) return { ok: false, error: "Position invalide." };
  const { error } = await supabaseAdmin.from("localites").update({ lat, lng }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de déplacer cette localité." };
  return { ok: true };
}

export async function definirRayonLocalite(id: number, rayonKm: number): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isFinite(rayonKm) || rayonKm < RAYON_MIN_KM || rayonKm > RAYON_MAX_KM) {
    return { ok: false, error: `Rayon entre ${RAYON_MIN_KM} et ${RAYON_MAX_KM} km.` };
  }
  const { error } = await supabaseAdmin.from("localites").update({ rayon_km: rayonKm }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de régler le rayon." };
  return { ok: true };
}

// `polygone` = null pour effacer la zone (on retombe sur le rayon).
export async function definirZoneLocalite(
  id: number,
  polygone: [number, number][] | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (polygone != null) {
    if (polygone.length < 3) return { ok: false, error: "Une zone a besoin d'au moins 3 points." };
    if (!polygone.every(([lng, lat]) => positionValide(lat, lng))) {
      return { ok: false, error: "Zone invalide." };
    }
  }
  const { error } = await supabaseAdmin.from("localites").update({ zone_polygone: polygone }).eq("id", id);
  if (error) return { ok: false, error: "Impossible d'enregistrer la zone." };
  return { ok: true };
}

// Ajout d'une localité en cliquant directement sur la carte (§3) : réutilise
// la validation de creerLocalite, juste sans passer par le formulaire texte.
export async function creerLocaliteSurCarte(
  nom: string,
  groupeId: number,
  lat: number,
  lng: number,
): Promise<ActionResult> {
  await requireAdmin();
  return creerLocalite({ nom, groupeId, lat, lng });
}
