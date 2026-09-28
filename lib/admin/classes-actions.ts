"use server";

import { requireAdmin } from "./guard";
import { texteNonVide } from "./validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "./produits-actions";
import type { ClasseDb, Cycle } from "@/lib/supabase/types";

// ADMIN.md Lot 3 : la liste des classes/séries vit en base (migration 0099),
// gérée ici — ajouter une classe ou une série, la masquer, changer l'ordre.

export async function getClassesAdmin(): Promise<ClasseDb[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("classes")
    .select("*")
    .order("cycle", { ascending: true })
    .order("ordre", { ascending: true });
  return data ?? [];
}

export type ClasseInput = { cycle: Cycle; classe: string; groupe: string | null };

export async function creerClasse(input: ClasseInput): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  if (!texteNonVide(input.classe, 60)) return { ok: false, error: "Le nom de la classe est requis." };

  const { count } = await supabaseAdmin
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("cycle", input.cycle);

  const { data, error } = await supabaseAdmin
    .from("classes")
    .insert({ cycle: input.cycle, classe: input.classe.trim(), groupe: input.groupe?.trim() || null, ordre: count ?? 0 })
    .select()
    .single();
  if (error || !data) return { ok: false, error: "Impossible de créer cette classe (déjà existante ?)." };
  return { ok: true, id: data.id };
}

export type ClassePatch = { classe?: string; groupe?: string | null; actif?: boolean };

export async function modifierClasse(id: number, patch: ClassePatch): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("classes").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Impossible de modifier cette classe." };
  return { ok: true };
}

// Monter/descendre une classe dans sa liste (même logique que
// deplacerKitItem : réécrit `ordre` = position pour toutes les classes
// du cycle plutôt que de supposer des valeurs distinctes au départ).
export async function deplacerClasse(cycle: Cycle, idsOrdonnes: number[], id: number, direction: -1 | 1): Promise<ActionResult> {
  await requireAdmin();
  const index = idsOrdonnes.indexOf(id);
  const cible = index + direction;
  if (index === -1 || cible < 0 || cible >= idsOrdonnes.length) return { ok: true };

  const reordonnes = [...idsOrdonnes];
  [reordonnes[index], reordonnes[cible]] = [reordonnes[cible], reordonnes[index]];

  const erreurs = await Promise.all(
    reordonnes.map((classeId, ordre) =>
      supabaseAdmin.from("classes").update({ ordre }).eq("id", classeId).eq("cycle", cycle),
    ),
  );
  if (erreurs.some((r) => r.error)) return { ok: false, error: "Impossible de réordonner." };
  return { ok: true };
}
