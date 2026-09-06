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
