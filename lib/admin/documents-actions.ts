"use server";

import { randomUUID } from "crypto";
import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "./produits-actions";
import type { Document } from "@/lib/supabase/types";

// TACHE_documents_telechargeables.md, lot 2 — gestion admin des notices de
// montage des kits électroniques. Même mécanique que lib/admin/ebooks-actions.ts
// (fichier privé, RLS sans policy sur la table sensible ici : `chemin_fichier`
// est un simple champ texte, jamais retourné aux requêtes publiques).

const TAILLE_MAX_DOCUMENT = 25 * 1024 * 1024; // 25 Mo
const TITRE_MAX = 120;
const TEXTE_MAX = 600;

export type ProduitLie = { id: number; nom: string };
export type DocumentAvecProduits = Document & { produits: ProduitLie[] };

function estPdf(octets: Uint8Array): boolean {
  return (
    octets.length >= 5 &&
    octets[0] === 0x25 &&
    octets[1] === 0x50 &&
    octets[2] === 0x44 &&
    octets[3] === 0x46 &&
    octets[4] === 0x2d
  );
}

export async function getDocumentsAdmin(): Promise<DocumentAvecProduits[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("*, documents_produits(produit:produits(id, nom))")
    .order("cree_le", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as Array<
    Document & { documents_produits: { produit: ProduitLie | ProduitLie[] | null }[] }
  >).map((d) => ({
    ...d,
    produits: d.documents_produits
      .map((dp) => (Array.isArray(dp.produit) ? dp.produit[0] : dp.produit))
      .filter((p): p is ProduitLie => !!p),
  }));
}

// Produits éligibles au rattachement : uniquement les kits électroniques
// (portée de ce chantier). Pas de recherche générale sur les 968 produits.
export async function getKitsPourDocuments(): Promise<ProduitLie[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("produits")
    .select("id, nom")
    .eq("est_kit", true)
    .order("nom");
  if (error) throw error;
  return (data ?? []) as ProduitLie[];
}

async function televerserFichier(
  file: File,
): Promise<{ ok: true; chemin: string; tailleKo: number } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "Aucun fichier reçu." };
  if (file.size > TAILLE_MAX_DOCUMENT) return { ok: false, error: "PDF trop lourd (25 Mo maximum)." };

  const buffer = await file.arrayBuffer();
  if (!estPdf(new Uint8Array(buffer.slice(0, 5)))) {
    return { ok: false, error: "Ce fichier n'est pas un PDF valide." };
  }

  const chemin = `${randomUUID()}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from("documents")
    .upload(chemin, buffer, { contentType: "application/pdf", upsert: false });
  if (error) return { ok: false, error: "Le téléversement a échoué." };
  return { ok: true, chemin, tailleKo: Math.round(file.size / 1024) };
}

export type DocumentInput = {
  titre: string;
  type: "notice" | "guide";
  acces: "libre" | "apres_achat";
  apercuUrl: string;
  nombrePages: number | null;
  apercuTexte: string;
  materielSupplementaire: string;
};

function validerChamps(input: DocumentInput): string | null {
  if (!input.titre.trim()) return "Donne un titre au document.";
  if (input.nombrePages !== null && (!Number.isFinite(input.nombrePages) || input.nombrePages < 0)) {
    return "Nombre de pages invalide.";
  }
  return null;
}

export async function creerDocument(input: DocumentInput, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerChamps(input);
  if (erreur) return { ok: false, error: erreur };

  const file = formData.get("fichier");
  if (!(file instanceof File)) return { ok: false, error: "Choisis un fichier PDF." };

  const up = await televerserFichier(file);
  if (!up.ok) return up;

  const { error } = await supabaseAdmin.from("documents").insert({
    titre: input.titre.trim().slice(0, TITRE_MAX),
    type: input.type,
    acces: input.acces,
    apercu_url: input.apercuUrl.trim() || null,
    nombre_pages: input.nombrePages,
    apercu_texte: input.apercuTexte.trim().slice(0, TEXTE_MAX) || null,
    materiel_supplementaire: input.materielSupplementaire.trim().slice(0, TEXTE_MAX) || null,
    chemin_fichier: up.chemin,
    taille_ko: up.tailleKo,
  });
  if (error) {
    await supabaseAdmin.storage.from("documents").remove([up.chemin]);
    return { ok: false, error: "Impossible d'enregistrer le document." };
  }
  return { ok: true };
}

export async function modifierDocument(id: number, input: DocumentInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerChamps(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin
    .from("documents")
    .update({
      titre: input.titre.trim().slice(0, TITRE_MAX),
      type: input.type,
      acces: input.acces,
      apercu_url: input.apercuUrl.trim() || null,
      nombre_pages: input.nombrePages,
      apercu_texte: input.apercuTexte.trim().slice(0, TEXTE_MAX) || null,
      materiel_supplementaire: input.materielSupplementaire.trim().slice(0, TEXTE_MAX) || null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier le document." };
  return { ok: true };
}

export async function remplacerFichierDocument(id: number, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const file = formData.get("fichier");
  if (!(file instanceof File)) return { ok: false, error: "Choisis un fichier PDF." };

  const { data: existant } = await supabaseAdmin
    .from("documents")
    .select("chemin_fichier")
    .eq("id", id)
    .maybeSingle();
  if (!existant) return { ok: false, error: "Document introuvable." };

  const up = await televerserFichier(file);
  if (!up.ok) return up;

  const { error } = await supabaseAdmin
    .from("documents")
    .update({ chemin_fichier: up.chemin, taille_ko: up.tailleKo })
    .eq("id", id);
  if (error) {
    await supabaseAdmin.storage.from("documents").remove([up.chemin]);
    return { ok: false, error: "Impossible de remplacer le fichier." };
  }
  await supabaseAdmin.storage.from("documents").remove([existant.chemin_fichier]);
  return { ok: true };
}

export async function basculerActifDocument(id: number, actif: boolean): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("documents").update({ actif }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de changer la visibilité." };
  return { ok: true };
}

export async function supprimerDocument(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { data: existant } = await supabaseAdmin
    .from("documents")
    .select("chemin_fichier")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("documents").delete().eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  if (existant) await supabaseAdmin.storage.from("documents").remove([existant.chemin_fichier]);
  return { ok: true };
}

export async function associerProduit(documentId: number, produitId: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("documents_produits")
    .upsert({ document_id: documentId, produit_id: produitId }, { onConflict: "document_id,produit_id" });
  if (error) return { ok: false, error: "Impossible de rattacher ce produit." };
  return { ok: true };
}

export async function dissocierProduit(documentId: number, produitId: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("documents_produits")
    .delete()
    .eq("document_id", documentId)
    .eq("produit_id", produitId);
  if (error) return { ok: false, error: "Impossible de retirer ce produit." };
  return { ok: true };
}

export type StatsDocument = {
  telechargements30j: number;
  acheteursDistincts30j: number;
  kitsVendus30j: number;
};

// Ratio téléchargements / kits vendus sur 30 jours : indicateur de combien
// d'acheteurs montent réellement leur kit (§7 du document source).
export async function getStatsDocument(documentId: number): Promise<StatsDocument> {
  await requireAdmin();
  const depuis = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: dls } = await supabaseAdmin
    .from("telechargements")
    .select("client_id")
    .eq("document_id", documentId)
    .gte("cree_le", depuis);
  const telechargements = dls ?? [];
  const acheteursDistincts = new Set(telechargements.map((d) => d.client_id).filter(Boolean)).size;

  const { data: produits } = await supabaseAdmin
    .from("documents_produits")
    .select("produit_id")
    .eq("document_id", documentId);
  const produitIds = (produits ?? []).map((p) => p.produit_id);

  let kitsVendus = 0;
  if (produitIds.length > 0) {
    const { count } = await supabaseAdmin
      .from("commande_items")
      .select("id, commande:commandes!inner(date, statut)", { count: "exact", head: true })
      .in("produit_id", produitIds)
      .gte("commande.date", depuis)
      .neq("commande.statut", "paiement_en_attente");
    kitsVendus = count ?? 0;
  }

  return {
    telechargements30j: telechargements.length,
    acheteursDistincts30j: acheteursDistincts,
    kitsVendus30j: kitsVendus,
  };
}
