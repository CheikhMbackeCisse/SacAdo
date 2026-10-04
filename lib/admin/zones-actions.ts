"use server";

import { requireAdmin } from "./guard";
import { estNombrePositifValide, texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  ajouterDateFermee,
  getHeureLimiteSamedi,
  getPaiementLivraisonMax,
  getSeuilLivraisonGratuite,
  retirerDateFermee,
  setHeureLimiteSamedi,
  setPaiementLivraisonMax,
  setSeuilLivraisonGratuite,
} from "@/lib/parametres";
import type { Zone } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

export async function getZonesAdmin(): Promise<Zone[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("zones").select("*").order("id", { ascending: true });
  return data ?? [];
}

export type ZoneInput = {
  nom: string;
  tarif_6j: number;
  tarif_24h: number;
  // Vide = délai « 24h / 6j » normal. Renseigné = ce texte remplace le délai
  // partout pour ce groupe (migration 0054).
  message_special: string | null;
};

const MESSAGE_MAX = 300;

function validerZoneInput(input: ZoneInput): string | null {
  if (!texteNonVide(input.nom, 100)) return "Le nom de la zone est requis.";
  if (!estNombrePositifValide(input.tarif_6j) || !estNombrePositifValide(input.tarif_24h)) {
    return "Les tarifs doivent être des nombres positifs.";
  }
  if (input.message_special != null && input.message_special.length > MESSAGE_MAX) {
    return "Le message est trop long.";
  }
  return null;
}

function versColonnes(input: ZoneInput) {
  return {
    nom: input.nom.trim(),
    tarif_6j: input.tarif_6j,
    tarif_24h: input.tarif_24h,
    message_special: input.message_special?.trim() || null,
  };
}

export async function creerZone(input: ZoneInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerZoneInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("zones").insert(versColonnes(input));
  if (error) return { ok: false, error: "Impossible de créer cette zone (nom déjà utilisé ?)." };
  return { ok: true };
}

export async function modifierZone(id: number, input: ZoneInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerZoneInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("zones").update(versColonnes(input)).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier cette zone." };
  return { ok: true };
}

// ============================================================================
// Réglage : seuil de livraison gratuite (IMPLEMENTATION_TARIFS_LIVRAISON.md §5).
// ============================================================================
export async function getSeuilLivraisonGratuiteActuel(): Promise<number | null> {
  await requireAdmin();
  return getSeuilLivraisonGratuite();
}

export async function reglerSeuilLivraisonGratuite(valeur: number | null): Promise<ActionResult> {
  await requireAdmin();
  return setSeuilLivraisonGratuite(valeur);
}

// Livraison "à date donnée" (maj-accueil §7).
export async function getHeureLimiteSamediActuelle(): Promise<string | null> {
  await requireAdmin();
  return getHeureLimiteSamedi();
}

export async function reglerHeureLimiteSamedi(valeur: string | null): Promise<ActionResult> {
  await requireAdmin();
  return setHeureLimiteSamedi(valeur);
}

export async function getDatesFermeesAdmin(): Promise<{ date: string; motif: string | null }[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("dates_fermees").select("date, motif").order("date");
  return data ?? [];
}

export async function ajouterDateFermeeAdmin(date: string, motif: string | null): Promise<ActionResult> {
  await requireAdmin();
  return ajouterDateFermee(date, motif);
}

export async function retirerDateFermeeAdmin(date: string): Promise<ActionResult> {
  await requireAdmin();
  return retirerDateFermee(date);
}

// Montant maximum pour le paiement à la livraison (PROMPT_ADMIN_V2 Lot 2) :
// au-delà, seul Wave est proposé au checkout. `null` = pas de limite.
export async function getPaiementLivraisonMaxActuel(): Promise<number | null> {
  await requireAdmin();
  return getPaiementLivraisonMax();
}

export async function reglerPaiementLivraisonMax(valeur: number | null): Promise<ActionResult> {
  await requireAdmin();
  return setPaiementLivraisonMax(valeur);
}
