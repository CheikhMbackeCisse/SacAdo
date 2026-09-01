"use server";

import { requireAdmin } from "./guard";
import { estNombrePositifValide, texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Zone } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

export async function getZonesAdmin(): Promise<Zone[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("zones").select("*").order("id", { ascending: true });
  return data ?? [];
}

export type ZoneInput = { nom: string; tarif_6j: number; tarif_24h: number };

function validerZoneInput(input: ZoneInput): string | null {
  if (!texteNonVide(input.nom, 100)) return "Le nom de la zone est requis.";
  if (!estNombrePositifValide(input.tarif_6j) || !estNombrePositifValide(input.tarif_24h)) {
    return "Les tarifs doivent être des nombres positifs.";
  }
  return null;
}

export async function creerZone(input: ZoneInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerZoneInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("zones").insert(input);
  if (error) return { ok: false, error: "Impossible de créer cette zone (nom déjà utilisé ?)." };
  return { ok: true };
}

export async function modifierZone(id: number, input: ZoneInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerZoneInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("zones").update(input).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier cette zone." };
  return { ok: true };
}
