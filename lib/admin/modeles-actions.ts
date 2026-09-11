"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CanalModele, ModeleMessage } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

// Édition des modèles de messages (migration 0057, TACHE_whatsapp_admin.md §5).
// Le contenu et le libellé sont modifiables sans redéploiement ; le code et le
// canal identifient la ligne et ne changent pas.

const CONTENU_MAX = 1500;
const LIBELLE_MAX = 80;
const TITRE_MAX = 120;

export async function getModelesAdmin(): Promise<ModeleMessage[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("modeles_messages")
    .select("*")
    .order("ordre", { ascending: true })
    .order("code", { ascending: true });
  return (data ?? []) as ModeleMessage[];
}

export type ModeleInput = {
  libelle: string;
  titre: string | null;
  contenu: string;
  ordre: number;
  actif: boolean;
};

function valider(input: ModeleInput, canal: CanalModele): string | null {
  const libelle = input.libelle.trim();
  const contenu = input.contenu.trim();
  if (!libelle) return "Le libellé est requis.";
  if (libelle.length > LIBELLE_MAX) return `Le libellé fait au plus ${LIBELLE_MAX} caractères.`;
  if (!contenu) return "Le contenu est requis.";
  if (contenu.length > CONTENU_MAX) return `Le contenu fait au plus ${CONTENU_MAX} caractères.`;
  if (input.titre != null && input.titre.trim().length > TITRE_MAX) {
    return `Le titre fait au plus ${TITRE_MAX} caractères.`;
  }
  // Un titre a du sens pour push / boîte de réception, pas pour WhatsApp.
  if (canal === "whatsapp" && input.titre != null && input.titre.trim().length > 0) {
    return "WhatsApp n'utilise pas de titre.";
  }
  if (!Number.isInteger(input.ordre) || input.ordre < 0 || input.ordre > 999) {
    return "L'ordre doit être un entier entre 0 et 999.";
  }
  return null;
}

export async function modifierModele(
  code: string,
  canal: CanalModele,
  input: ModeleInput,
): Promise<ActionResult> {
  await requireAdmin();

  const erreur = valider(input, canal);
  if (erreur) return { ok: false, error: erreur };

  const titre = input.titre?.trim() || null;
  const { error, count } = await supabaseAdmin
    .from("modeles_messages")
    .update(
      {
        libelle: input.libelle.trim(),
        titre,
        contenu: input.contenu.trim(),
        ordre: input.ordre,
        actif: input.actif,
        maj_le: new Date().toISOString(),
      },
      { count: "exact" },
    )
    .eq("code", code)
    .eq("canal", canal);

  if (error) return { ok: false, error: "Impossible d'enregistrer ce modèle." };
  if (!count) return { ok: false, error: "Modèle introuvable." };
  return { ok: true };
}
