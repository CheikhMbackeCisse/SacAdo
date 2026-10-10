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

// Lieux spéciaux à date de livraison figée (EPT…) : alimente le filtre
// "préparer la tournée" de /admin/commandes (TACHE_bug_checkout_ept.md §4),
// sans lien en dur sur l'EPT — n'importe quel lieu avec une date fixée y
// apparaît.
export async function getLieuxSpeciauxDateFixe(): Promise<{ nom: string; date: string }[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("lieux_speciaux")
    .select("nom, date_livraison_fixe")
    .not("date_livraison_fixe", "is", null)
    .order("date_livraison_fixe", { ascending: true });
  return (data ?? []).map((l) => ({ nom: l.nom as string, date: l.date_livraison_fixe as string }));
}

export type LieuSpecialInput = {
  nom: string;
  tarif: number | null;
  mode: ModeLieuSpecial;
  message: string | null;
  // Géolocalisation + rayon (migration 0119) : un point de livraison dans ce
  // rayon résout automatiquement ce lieu, sans sélection manuelle.
  lat: number | null;
  lng: number | null;
  rayonM: number | null;
  // Mots-clés qui déclenchent ce lieu quand tapés dans une recherche.
  motsCles: string[];
  // Date de livraison figée (EPT : livraison groupée, sans date limite de
  // commande). null = délai normal.
  dateLivraisonFixe: string | null;
};

const MODES_VALIDES: ModeLieuSpecial[] = ["livraison", "retrait", "a_confirmer"];
const MOT_CLE_MAX = 60;
const MOTS_CLES_MAX = 30;

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
  if ((input.lat == null) !== (input.lng == null)) {
    return "Latitude et longitude doivent être renseignées ensemble.";
  }
  if (input.lat != null && (input.lat < -90 || input.lat > 90)) return "Latitude invalide.";
  if (input.lng != null && (input.lng < -180 || input.lng > 180)) return "Longitude invalide.";
  if (input.rayonM != null && (!Number.isFinite(input.rayonM) || input.rayonM <= 0 || input.rayonM > 50000)) {
    return "Le rayon doit être un nombre de mètres positif.";
  }
  if (input.motsCles.length > MOTS_CLES_MAX || input.motsCles.some((m) => m.length > MOT_CLE_MAX)) {
    return "Mots-clés trop nombreux ou trop longs.";
  }
  return null;
}

function versColonnes(input: LieuSpecialInput) {
  return {
    nom: input.nom.trim(),
    tarif: input.mode === "a_confirmer" ? null : input.tarif,
    mode: input.mode,
    message: input.message?.trim() || null,
    lat: input.lat,
    lng: input.lng,
    rayon_m: input.rayonM,
    mots_cles: input.motsCles,
    date_livraison_fixe: input.dateLivraisonFixe,
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
