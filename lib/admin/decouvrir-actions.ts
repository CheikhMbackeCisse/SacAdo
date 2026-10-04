"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "./produits-actions";
import type { StatutPublication } from "@/lib/supabase/types";

// Éditeur « À découvrir » (PROMPT_ADMIN_V2 Lot 4) : remplace la section
// "Épinglage & exclusion" de /admin/classement (formulaire id + position) par
// un aperçu visuel réordonnable. Même mécanisme en base (`classement_manuel`),
// juste une meilleure façon de le piloter.

export type CarteDecouvrir = {
  produitId: number;
  nom: string;
  photo: string | null;
  prix: number;
  statutPublication: StatutPublication;
  stock: number;
  // Était déjà épinglé avant l'ouverture de l'éditeur (affiché "épinglé" /
  // "automatique" sur la carte) — n'est pas réévalué pendant l'édition, pour
  // que le badge reste stable tant qu'on n'a pas enregistré.
  epingleAvant: boolean;
};

// Taille visée de l'aperçu : tous les produits déjà épinglés (jamais tronqués,
// sinon un ancien épinglage disparaîtrait de l'écran sans que l'admin l'ait
// voulu) + de quoi compléter jusqu'à ce total avec les meilleurs automatiques.
const TAILLE_APERCU = 24;

async function chargerClassementManuel(): Promise<{ produitId: number; position: number | null }[]> {
  const { data } = await supabaseAdmin
    .from("classement_manuel")
    .select("produit_id, position")
    .eq("exclu", false)
    .order("position", { ascending: true, nullsFirst: false });
  return (data ?? []).map((m) => ({ produitId: m.produit_id as number, position: m.position as number | null }));
}

async function cartesPour(idsOrdonnes: number[], pinnedSet: Set<number>): Promise<CarteDecouvrir[]> {
  if (idsOrdonnes.length === 0) return [];
  const { data: produits } = await supabaseAdmin
    .from("produits")
    .select("id, nom, photo, prix, statut_publication, stock")
    .in("id", idsOrdonnes);
  const parId = new Map((produits ?? []).map((p) => [p.id as number, p]));

  return idsOrdonnes
    .map((id) => parId.get(id))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map((p) => ({
      produitId: p.id as number,
      nom: p.nom as string,
      photo: p.photo as string | null,
      prix: p.prix as number,
      statutPublication: p.statut_publication as StatutPublication,
      stock: p.stock as number,
      epingleAvant: pinnedSet.has(p.id as number),
    }));
}

export async function getApercuDecouvrir(): Promise<CarteDecouvrir[]> {
  await requireAdmin();

  const manuel = await chargerClassementManuel();
  const pinnedIds = manuel.map((m) => m.produitId);
  const pinnedSet = new Set(pinnedIds);

  const { data: top } = await supabaseAdmin
    .from("produits")
    .select("id")
    .eq("statut_publication", "publie")
    .order("score_global", { ascending: false })
    .order("id", { ascending: true })
    .limit(TAILLE_APERCU);
  const autoIds = (top ?? []).map((p) => p.id as number).filter((id) => !pinnedSet.has(id));

  const complement = Math.max(0, TAILLE_APERCU - pinnedIds.length);
  const idsOrdonnes = [...pinnedIds, ...autoIds.slice(0, complement)];

  return cartesPour(idsOrdonnes, pinnedSet);
}

// Recherche pour "ajouter un produit à une place précise" — même champ
// `recherche_texte` que la page Produits (lib/admin/produits-actions.ts).
export async function rechercherProduitDecouvrir(terme: string): Promise<CarteDecouvrir[]> {
  await requireAdmin();
  const t = terme.trim().slice(0, 60);
  if (t.length < 2) return [];

  const { data: normalise } = await supabaseAdmin.rpc("normaliser_recherche", { texte: t });
  const mots = ((normalise as string | null) ?? t.toLowerCase()).split(/\s+/).filter(Boolean);
  let query = supabaseAdmin
    .from("produits")
    .select("id, nom, photo, prix, statut_publication, stock")
    .order("nom", { ascending: true })
    .limit(15);
  for (const mot of mots) query = query.ilike("recherche_texte", `%${mot}%`);
  const { data } = await query;

  const manuel = await chargerClassementManuel();
  const pinnedSet = new Set(manuel.map((m) => m.produitId));

  return (data ?? []).map((p) => ({
    produitId: p.id as number,
    nom: p.nom as string,
    photo: p.photo as string | null,
    prix: p.prix as number,
    statutPublication: p.statut_publication as StatutPublication,
    stock: p.stock as number,
    epingleAvant: pinnedSet.has(p.id as number),
  }));
}

export type EnregistrerDecouvrirInput = {
  // Liste finale, dans l'ordre d'affichage voulu.
  ordre: number[];
  // Produits retirés de « À découvrir » pendant cette session d'édition
  // (bouton "Retirer de l'accueil") — passent à exclu=true à l'enregistrement.
  retires: number[];
};

export async function enregistrerDecouvrir(input: EnregistrerDecouvrirInput): Promise<ActionResult> {
  const user = await requireAdmin();

  const ordre = input.ordre.filter((id) => Number.isInteger(id) && id > 0);
  const retires = input.retires.filter((id) => Number.isInteger(id) && id > 0 && !ordre.includes(id));
  if (ordre.length === 0) return { ok: false, error: "La liste ne peut pas être vide." };
  if (ordre.length > 60) return { ok: false, error: "60 produits au maximum." };
  if (new Set(ordre).size !== ordre.length) return { ok: false, error: "Un même produit apparaît deux fois." };

  const lignesOrdre = ordre.map((produitId, i) => ({ produit_id: produitId, position: i + 1, exclu: false }));
  const { error: erreurOrdre } = await supabaseAdmin
    .from("classement_manuel")
    .upsert(lignesOrdre, { onConflict: "produit_id" });
  if (erreurOrdre) return { ok: false, error: "Impossible d'enregistrer l'ordre." };

  if (retires.length > 0) {
    const lignesRetires = retires.map((produitId) => ({ produit_id: produitId, position: null, exclu: true }));
    const { error: erreurRetires } = await supabaseAdmin
      .from("classement_manuel")
      .upsert(lignesRetires, { onConflict: "produit_id" });
    if (erreurRetires) return { ok: false, error: "Impossible d'enregistrer les retraits." };
  }

  const resume =
    retires.length > 0
      ? `${ordre.length} produit${ordre.length > 1 ? "s" : ""} épinglé${ordre.length > 1 ? "s" : ""}, ${retires.length} retiré${retires.length > 1 ? "s" : ""} de « À découvrir ».`
      : `${ordre.length} produit${ordre.length > 1 ? "s" : ""} épinglé${ordre.length > 1 ? "s" : ""} en tête de « À découvrir ».`;
  await supabaseAdmin.from("journal_decouvrir").insert({ admin_user_id: user.id, resume });

  return { ok: true };
}

export type DernierJournalDecouvrir = { resume: string; majLe: string; email: string | null };

export async function getDernierJournalDecouvrir(): Promise<DernierJournalDecouvrir | null> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("journal_decouvrir")
    .select("resume, maj_le, admins(email)")
    .order("maj_le", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const admin = Array.isArray(data.admins) ? data.admins[0] : data.admins;
  return {
    resume: data.resume as string,
    majLe: data.maj_le as string,
    email: (admin as { email?: string | null } | null)?.email ?? null,
  };
}
