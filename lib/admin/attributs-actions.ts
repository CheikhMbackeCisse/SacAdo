"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "./produits-actions";
import type { Attribut } from "@/lib/supabase/types";

function nettoyerNom(valeur: string): string {
  return valeur.trim().replace(/\s+/g, " ").slice(0, 60);
}

// Liste complète (proposés + validés) — écran d'administration des attributs.
export async function getAttributsAdmin(): Promise<Attribut[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("attributs")
    .select("*")
    .order("statut", { ascending: true }) // 'propose' avant 'valide'
    .order("nom", { ascending: true });
  return data ?? [];
}

// Attributs validés seulement — proposés dans le select « Ajouter un attribut ».
export async function getAttributsValides(): Promise<Attribut[]> {
  const { data } = await supabaseAdmin
    .from("attributs")
    .select("*")
    .eq("statut", "valide")
    .order("nom", { ascending: true });
  return data ?? [];
}

// Trouve un attribut par nom (insensible à la casse) — pour dédoublonner.
async function trouverParNom(nom: string): Promise<Attribut | null> {
  const cible = nom.toLowerCase();
  const { data } = await supabaseAdmin.from("attributs").select("*");
  return (data ?? []).find((a) => a.nom.trim().toLowerCase() === cible) ?? null;
}

// Ajout direct par l'admin (validé d'office).
export async function creerAttribut(nom: string): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const propre = nettoyerNom(nom);
  if (propre.length < 2) return { ok: false, error: "Nom d'attribut trop court." };
  if (await trouverParNom(propre)) return { ok: false, error: "Cet attribut existe déjà." };

  const { data, error } = await supabaseAdmin
    .from("attributs")
    .insert({ nom: propre, statut: "valide" })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Impossible de créer l'attribut." };
  return { ok: true, id: data.id };
}

// Proposition (par l'admin depuis le formulaire variante, ou par un vendeur).
// Si un attribut du même nom existe déjà, on renvoie son id sans rien créer.
export async function proposerAttribut(
  nom: string,
  proposePar: string | null = null,
): Promise<ActionResult & { id?: number; dejaExistant?: boolean }> {
  const propre = nettoyerNom(nom);
  if (propre.length < 2) return { ok: false, error: "Nom d'attribut trop court." };

  const existant = await trouverParNom(propre);
  if (existant) return { ok: true, id: existant.id, dejaExistant: true };

  const { data, error } = await supabaseAdmin
    .from("attributs")
    .insert({ nom: propre, statut: "propose", propose_par: proposePar })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Impossible d'enregistrer la proposition." };
  return { ok: true, id: data.id };
}

export async function validerAttribut(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("attributs")
    .update({ statut: "valide" })
    .eq("id", id);
  if (error) return { ok: false, error: "Validation impossible." };
  return { ok: true };
}

export async function renommerAttribut(id: number, nom: string): Promise<ActionResult> {
  await requireAdmin();
  const propre = nettoyerNom(nom);
  if (propre.length < 2) return { ok: false, error: "Nom d'attribut trop court." };
  const autre = await trouverParNom(propre);
  if (autre && autre.id !== id) return { ok: false, error: "Un attribut porte déjà ce nom." };

  const { error } = await supabaseAdmin.from("attributs").update({ nom: propre }).eq("id", id);
  if (error) return { ok: false, error: "Renommage impossible." };
  return { ok: true };
}

// Fusionne `sourceId` dans `cibleId` : réaffecte les valeurs de variante puis
// supprime la source. Utile quand un vendeur a proposé « coloris » ≈ « Couleur ».
export async function fusionnerAttribut(sourceId: number, cibleId: number): Promise<ActionResult> {
  await requireAdmin();
  if (sourceId === cibleId) return { ok: false, error: "Choisis deux attributs différents." };

  // Une variante qui porte déjà l'attribut cible ne peut pas recevoir la source
  // (contrainte unique) : on retire d'abord ces doublons.
  const { data: cibleRows } = await supabaseAdmin
    .from("variante_attributs")
    .select("variante_id")
    .eq("attribut_id", cibleId);
  const variantesAvecCible = new Set((cibleRows ?? []).map((r) => r.variante_id));

  if (variantesAvecCible.size > 0) {
    await supabaseAdmin
      .from("variante_attributs")
      .delete()
      .eq("attribut_id", sourceId)
      .in("variante_id", [...variantesAvecCible]);
  }

  await supabaseAdmin
    .from("variante_attributs")
    .update({ attribut_id: cibleId })
    .eq("attribut_id", sourceId);

  const { error } = await supabaseAdmin.from("attributs").delete().eq("id", sourceId);
  if (error) return { ok: false, error: "Suppression de l'attribut source impossible." };
  return { ok: true };
}

export async function supprimerAttribut(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("attributs").delete().eq("id", id);
  if (error) {
    return { ok: false, error: "Impossible : cet attribut est utilisé par des variantes." };
  }
  return { ok: true };
}
