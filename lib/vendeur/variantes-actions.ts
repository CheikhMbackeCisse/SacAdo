"use server";

import { requireVendeur } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aplatirAttributs } from "@/lib/variantes";
import { estNombrePositifValide } from "@/lib/admin/validation";
import { proposerAttribut } from "@/lib/admin/attributs-actions";
import type { ActionResult } from "./produits-actions";
import type { Attribut, VarianteAvecAttributs } from "@/lib/supabase/types";

const SELECT_VARIANTE = "*, variante_attributs(attribut_id, valeur, attributs(nom))";
const VALEUR_MAX = 120;
const COMBINAISONS_MAX = 100;

// Une combinaison à enregistrer : 1..N couples (attribut, valeur) + stock + prix.
export type LigneVarianteInput = {
  attributs: { attributId: number; valeur: string }[];
  prix: number | null;
  stock: number;
};

// Le produit appartient-il au vendeur connecté ?
async function produitDuVendeur(produitId: number, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("produits")
    .select("id")
    .eq("id", produitId)
    .eq("vendeur_id", userId)
    .maybeSingle();
  return !!data;
}

// Attributs utilisables tout de suite (validés). Le vendeur en propose d'autres
// via proposerMonAttribut → file de validation admin.
export async function getAttributsUtilisables(): Promise<Attribut[]> {
  await requireVendeur();
  const { data } = await supabaseAdmin
    .from("attributs")
    .select("*")
    .eq("statut", "valide")
    .order("nom", { ascending: true });
  return data ?? [];
}

// Proposition d'un nouvel attribut par le vendeur (statut 'propose').
export async function proposerMonAttribut(
  nom: string,
): Promise<ActionResult & { id?: number; dejaExistant?: boolean }> {
  const { userId } = await requireVendeur();
  return proposerAttribut(nom, userId);
}

export async function getMesVariantes(produitId: number): Promise<VarianteAvecAttributs[]> {
  const { userId } = await requireVendeur();
  if (!(await produitDuVendeur(produitId, userId))) return [];

  const jointure = await supabaseAdmin
    .from("produit_variantes")
    .select(SELECT_VARIANTE)
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  if (!jointure.error) {
    return (jointure.data ?? []).map((row) => ({ ...row, attributs: aplatirAttributs(row) }));
  }
  const { data } = await supabaseAdmin
    .from("produit_variantes")
    .select("*")
    .eq("produit_id", produitId)
    .order("id", { ascending: true });
  return (data ?? []).map((row) => ({ ...(row as VarianteAvecAttributs), attributs: [] }));
}

// Signature stable d'une combinaison : couples (attribut, valeur normalisée)
// triés par attribut. Sert à rapprocher une ligne saisie d'une variante en base.
function signature(paires: { attributId: number; valeur: string }[]): string {
  return paires
    .map((p) => ({ id: p.attributId, v: p.valeur.trim().toLowerCase().slice(0, VALEUR_MAX) }))
    .sort((a, b) => a.id - b.id || a.v.localeCompare(b.v))
    .map((p) => `${p.id}:${p.v}`)
    .join("|");
}

function nettoyerLigne(ligne: LigneVarianteInput) {
  const paires = ligne.attributs
    .map((a) => ({ attributId: a.attributId, valeur: a.valeur.trim().slice(0, VALEUR_MAX) }))
    .filter((a) => a.attributId > 0 && a.valeur);
  return { paires, prix: ligne.prix, stock: ligne.stock };
}

function validerLignes(lignes: ReturnType<typeof nettoyerLigne>[]): string | null {
  if (lignes.length > COMBINAISONS_MAX) {
    return `Trop de combinaisons (${COMBINAISONS_MAX} maximum). Réduis le nombre de valeurs.`;
  }
  const signatures = new Set<string>();
  for (const ligne of lignes) {
    if (ligne.paires.length === 0) return "Chaque variante doit porter au moins un attribut.";
    const ids = ligne.paires.map((p) => p.attributId);
    if (new Set(ids).size !== ids.length) return "Un attribut est en double dans une variante.";
    if (!estNombrePositifValide(ligne.stock)) return "Le stock doit être un nombre positif.";
    if (ligne.prix !== null && !estNombrePositifValide(ligne.prix)) {
      return "Le prix d'une variante doit être un nombre positif.";
    }
    const sig = signature(ligne.paires);
    if (signatures.has(sig)) return "Deux variantes ont exactement les mêmes attributs.";
    signatures.add(sig);
  }
  return null;
}

async function ecrireAttributs(
  varianteId: number,
  paires: { attributId: number; valeur: string }[],
): Promise<boolean> {
  await supabaseAdmin.from("variante_attributs").delete().eq("variante_id", varianteId);
  const lignes = paires.map((p) => ({
    variante_id: varianteId,
    attribut_id: p.attributId,
    valeur: p.valeur,
  }));
  if (lignes.length === 0) return true;
  const { error } = await supabaseAdmin.from("variante_attributs").insert(lignes);
  return !error;
}

// Remplace TOUT le jeu de variantes d'un produit par la liste fournie :
//   - combinaison déjà en base (même signature d'attributs) → stock / prix mis à jour ;
//   - combinaison nouvelle → créée ;
//   - variante en base absente de la liste → supprimée, SAUF si une commande la
//     référence (contrainte FK) : on la laisse alors et on le signale.
// Liste vide = le produit revient à son stock global (aucune variante).
export async function remplacerMesVariantes(
  produitId: number,
  lignesBrutes: LigneVarianteInput[],
): Promise<ActionResult & { avertissement?: string }> {
  const { userId } = await requireVendeur();
  if (!(await produitDuVendeur(produitId, userId))) {
    return { ok: false, error: "Produit introuvable." };
  }

  const lignes = lignesBrutes.map(nettoyerLigne);
  const erreur = validerLignes(lignes);
  if (erreur) return { ok: false, error: erreur };

  const existantes = await getMesVariantes(produitId);
  const parSignature = new Map(
    existantes.map((v) => [
      signature(v.attributs.map((a) => ({ attributId: a.attribut_id, valeur: a.valeur }))),
      v,
    ]),
  );

  const signaturesVoulues = new Set<string>();

  for (const ligne of lignes) {
    const sig = signature(ligne.paires);
    signaturesVoulues.add(sig);
    const existante = parSignature.get(sig);

    if (existante) {
      const { error } = await supabaseAdmin
        .from("produit_variantes")
        .update({ prix: ligne.prix, stock: ligne.stock })
        .eq("id", existante.id);
      if (error) return { ok: false, error: "Impossible de mettre à jour une variante." };
      if (!(await ecrireAttributs(existante.id, ligne.paires))) {
        return { ok: false, error: "Impossible d'enregistrer les attributs d'une variante." };
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from("produit_variantes")
        .insert({ produit_id: produitId, prix: ligne.prix, stock: ligne.stock, photo: null })
        .select("id")
        .single();
      if (error || !data) return { ok: false, error: "Impossible de créer une variante." };
      if (!(await ecrireAttributs(data.id, ligne.paires))) {
        await supabaseAdmin.from("produit_variantes").delete().eq("id", data.id);
        return { ok: false, error: "Impossible d'enregistrer les attributs d'une variante." };
      }
    }
  }

  let bloquees = 0;
  for (const variante of existantes) {
    const sig = signature(
      variante.attributs.map((a) => ({ attributId: a.attribut_id, valeur: a.valeur })),
    );
    if (signaturesVoulues.has(sig)) continue;
    const { error } = await supabaseAdmin
      .from("produit_variantes")
      .delete()
      .eq("id", variante.id);
    if (error) bloquees += 1;
  }

  if (bloquees > 0) {
    return {
      ok: true,
      avertissement:
        "Certaines variantes déjà commandées n'ont pas pu être retirées ; leur stock a été laissé tel quel.",
    };
  }
  return { ok: true };
}
