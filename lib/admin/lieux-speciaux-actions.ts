"use server";

import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { LieuSpecial, ModeLieuSpecial } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

export async function getLieuxSpeciauxAdmin(): Promise<LieuSpecial[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("lieux_speciaux").select("*").order("nom", { ascending: true });
  return (data ?? []) as LieuSpecial[];
}

export type LieuSpecialInput = {
  nom: string;
  tarif: number | null;
  mode: ModeLieuSpecial;
  message: string | null;
};

const MODES_VALIDES: ModeLieuSpecial[] = ["livraison", "retrait", "a_confirmer"];

function validerLieuSpecialInput(input: LieuSpecialInput): string | null {
  if (!texteNonVide(input.nom, 150)) return "Le nom du lieu est requis.";
  if (!MODES_VALIDES.includes(input.mode)) return "Mode invalide.";
  if (input.mode === "a_confirmer") {
    if (input.tarif != null) return "Pas de tarif fixe possible en mode « à confirmer ».";
  } else if (!Number.isFinite(input.tarif) || (input.tarif as number) < 0) {
    return "Le tarif doit être un nombre positif.";
  }
  if (input.message != null && input.message.length > 300) {
    return "Le message est trop long (300 caractères maximum).";
  }
  return null;
}

function versColonnes(input: LieuSpecialInput) {
  return {
    nom: input.nom.trim(),
    tarif: input.mode === "a_confirmer" ? null : input.tarif,
    mode: input.mode,
    message: input.message?.trim() || null,
  };
}

export async function creerLieuSpecial(input: LieuSpecialInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerLieuSpecialInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("lieux_speciaux").insert(versColonnes(input));
  if (error) return { ok: false, error: "Impossible de créer ce lieu (nom déjà utilisé ?)." };
  return { ok: true };
}

export async function modifierLieuSpecial(id: number, input: LieuSpecialInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerLieuSpecialInput(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("lieux_speciaux").update(versColonnes(input)).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier ce lieu." };
  return { ok: true };
}

export async function supprimerLieuSpecial(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("lieux_speciaux").delete().eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  return { ok: true };
}
