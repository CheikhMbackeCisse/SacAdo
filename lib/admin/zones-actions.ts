"use server";

import { requireAdmin } from "./guard";
import { estNombrePositifValide, texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSeuilLivraisonGratuite, setSeuilLivraisonGratuite } from "@/lib/parametres";
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
export async function getSeuilLivraisonGratuiteActuel(): Promise<number> {
  await requireAdmin();
  return getSeuilLivraisonGratuite();
}

export async function reglerSeuilLivraisonGratuite(valeur: number): Promise<ActionResult> {
  await requireAdmin();
  return setSeuilLivraisonGratuite(valeur);
}
