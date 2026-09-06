"use server";

import { randomUUID } from "crypto";
import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCycleByValue } from "@/lib/cycles";
import type { ActionResult } from "./produits-actions";
import type { Ebook, EbookClasse } from "@/lib/supabase/types";

// MODULE_EBOOKS.md, Partie 1, lot 3 — gestion des ebooks côté admin.
// Le fichier est un PDF fourni par SacAdo, rangé dans le bucket PRIVÉ `ebooks`.
// Tout passe par service_role (RLS sans policy sur ebooks / ebook_classes).

const TAILLE_MAX_EBOOK = 25 * 1024 * 1024; // 25 Mo
const TITRE_MAX = 120;

export type EbookAvecClasses = Ebook & { classes: EbookClasse[] };

// Magic bytes "%PDF-" : le type MIME annoncé par le navigateur est falsifiable
// sur un appel direct (même raison que le sniff image, AUDIT_SECURITE_3 F1).
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

export async function getEbooksAdmin(): Promise<EbookAvecClasses[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("ebooks")
    .select("*, classes:ebook_classes(*)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as EbookAvecClasses[];
}

async function televerserFichier(
  file: File,
): Promise<{ ok: true; chemin: string; taille: number } | { ok: false; error: string }> {
  if (file.size === 0) return { ok: false, error: "Aucun fichier reçu." };
  if (file.size > TAILLE_MAX_EBOOK) return { ok: false, error: "PDF trop lourd (25 Mo maximum)." };

  const buffer = await file.arrayBuffer();
  if (!estPdf(new Uint8Array(buffer.slice(0, 5)))) {
    return { ok: false, error: "Ce fichier n'est pas un PDF valide." };
  }

  const chemin = `${randomUUID()}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from("ebooks")
    .upload(chemin, buffer, { contentType: "application/pdf", upsert: false });
  if (error) return { ok: false, error: "Le téléversement a échoué." };
  return { ok: true, chemin, taille: file.size };
}

export async function creerEbook(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const titre = String(formData.get("titre") ?? "").trim().slice(0, TITRE_MAX);
  const file = formData.get("fichier");
  if (!titre) return { ok: false, error: "Donne un titre à l'ebook." };
  if (!(file instanceof File)) return { ok: false, error: "Choisis un fichier PDF." };

  const up = await televerserFichier(file);
  if (!up.ok) return up;

  const { error } = await supabaseAdmin
    .from("ebooks")
    .insert({ titre, fichier_chemin: up.chemin, taille_octets: up.taille });
  if (error) {
    await supabaseAdmin.storage.from("ebooks").remove([up.chemin]);
    return { ok: false, error: "Impossible d'enregistrer l'ebook." };
  }
  return { ok: true };
}

export async function remplacerFichierEbook(id: number, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const file = formData.get("fichier");
  if (!(file instanceof File)) return { ok: false, error: "Choisis un fichier PDF." };

  const { data: existant } = await supabaseAdmin
    .from("ebooks")
    .select("fichier_chemin")
    .eq("id", id)
    .maybeSingle();
  if (!existant) return { ok: false, error: "Ebook introuvable." };

  const up = await televerserFichier(file);
  if (!up.ok) return up;

  const { error } = await supabaseAdmin
    .from("ebooks")
    .update({ fichier_chemin: up.chemin, taille_octets: up.taille })
    .eq("id", id);
  if (error) {
    await supabaseAdmin.storage.from("ebooks").remove([up.chemin]);
    return { ok: false, error: "Impossible de remplacer le fichier." };
  }
  // Ancien fichier retiré seulement après le succès du remplacement en base.
  await supabaseAdmin.storage.from("ebooks").remove([existant.fichier_chemin]);
  return { ok: true };
}

export async function renommerEbook(id: number, titre: string): Promise<ActionResult> {
  await requireAdmin();
  const t = titre.trim().slice(0, TITRE_MAX);
  if (!t) return { ok: false, error: "Le titre ne peut pas être vide." };
  const { error } = await supabaseAdmin.from("ebooks").update({ titre: t }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de renommer l'ebook." };
  return { ok: true };
}

export async function supprimerEbook(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { data: existant } = await supabaseAdmin
    .from("ebooks")
    .select("fichier_chemin")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabaseAdmin.from("ebooks").delete().eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  if (existant) await supabaseAdmin.storage.from("ebooks").remove([existant.fichier_chemin]);
  return { ok: true };
}

function classeValide(cycle: string, niveau: string): boolean {
  const c = getCycleByValue(cycle);
  return !!c && c.classes.includes(niveau);
}

// unique(cycle, niveau) : une classe ne pointe que vers un seul ebook. Associer
// une classe déjà prise la réattribue au nouvel ebook.
export async function associerClasse(
  ebookId: number,
  cycle: string,
  niveau: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!classeValide(cycle, niveau)) return { ok: false, error: "Classe inconnue." };

  const { error } = await supabaseAdmin
    .from("ebook_classes")
    .upsert({ ebook_id: ebookId, cycle, niveau }, { onConflict: "cycle,niveau" });
  if (error) return { ok: false, error: "Impossible d'associer cette classe." };
  return { ok: true };
}

export async function dissocierClasse(ebookClasseId: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("ebook_classes").delete().eq("id", ebookClasseId);
  if (error) return { ok: false, error: "Impossible de retirer cette classe." };
  return { ok: true };
}
