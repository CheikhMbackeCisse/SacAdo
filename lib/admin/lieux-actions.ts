"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { texteNonVide } from "@/lib/admin/validation";
import type { ActionResult } from "./produits-actions";

// Lieux connus (repères saisis à la main) — GROUPE_A_ui_kit_carte.md §2.
// Alimentent en priorité la recherche d'adresse du checkout via /api/geocoding.

export type LieuConnu = {
  id: number;
  nom: string;
  lat: number;
  lng: number;
  created_at: string;
};

export type LieuConnuInput = {
  nom: string;
  lat: number | null;
  lng: number | null;
};

export async function getLieuxConnus(): Promise<LieuConnu[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("lieux_connus")
    .select("*")
    .order("nom", { ascending: true });
  return (data ?? []) as LieuConnu[];
}

function valider(input: LieuConnuInput): string | null {
  if (!texteNonVide(input.nom, 160)) return "Le nom du lieu est requis (160 caractères max).";
  if (input.lat == null || input.lng == null) return "Place le point sur la carte.";
  if (Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) return "Position invalide.";
  return null;
}

export async function creerLieuConnu(input: LieuConnuInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("lieux_connus").insert({
    nom: input.nom.trim(),
    lat: input.lat,
    lng: input.lng,
  });
  if (error) return { ok: false, error: "Impossible d'enregistrer le lieu." };
  return { ok: true };
}

export async function modifierLieuConnu(id: number, input: LieuConnuInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = valider(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("lieux_connus")
    .update({ nom: input.nom.trim(), lat: input.lat, lng: input.lng })
    .eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier le lieu." };
  return { ok: true };
}

export async function supprimerLieuConnu(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("lieux_connus").delete().eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  return { ok: true };
}
