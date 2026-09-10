"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normaliserTerme } from "@/lib/recherche/normaliser";
import type { ActionResult } from "./produits-actions";

// Synonymes de recherche (migration 0041, TACHE_recherche_produits_v2.md §3).
// Des GROUPES, pas des paires : dans un groupe, tous les termes sont
// interchangeables dans les deux sens, donc « bic » trouve les stylos et
// « stylo » trouve les bics sans avoir à saisir les deux sens.

export type Synonyme = { id: number; groupe: number; terme: string };
export type GroupeSynonymes = { groupe: number; termes: Synonyme[] };

const LONGUEUR_MAX_TERME = 60;
// Postgres 23505 = violation d'unicité (`synonymes.terme` est unique).
const DOUBLON = "23505";

export async function getSynonymes(): Promise<GroupeSynonymes[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("synonymes")
    .select("id, groupe, terme")
    .order("groupe", { ascending: true })
    .order("terme", { ascending: true });

  const parGroupe = new Map<number, Synonyme[]>();
  for (const s of (data ?? []) as Synonyme[]) {
    const liste = parGroupe.get(s.groupe);
    if (liste) liste.push(s);
    else parGroupe.set(s.groupe, [s]);
  }
  return [...parGroupe.entries()]
    .map(([groupe, termes]) => ({ groupe, termes }))
    .sort((a, b) => a.groupe - b.groupe);
}

function validerTerme(terme: string): string | null {
  if (terme.length < 2) return "Un terme fait au moins 2 caractères.";
  if (terme.length > LONGUEUR_MAX_TERME) {
    return `Un terme fait au plus ${LONGUEUR_MAX_TERME} caractères.`;
  }
  return null;
}

// Un terme déjà présent ailleurs : on dit dans quel groupe, plutôt qu'une
// erreur technique. L'admin saura s'il doit fusionner ou renoncer.
async function messageDoublon(terme: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("synonymes")
    .select("groupe")
    .eq("terme", terme)
    .maybeSingle();
  return data
    ? `« ${terme} » est déjà dans le groupe ${data.groupe}.`
    : `« ${terme} » existe déjà.`;
}

export async function ajouterTermeSynonyme(groupe: number, brut: string): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(groupe)) return { ok: false, error: "Groupe invalide." };

  const terme = normaliserTerme(brut);
  const erreur = validerTerme(terme);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("synonymes").insert({ groupe, terme });
  if (error?.code === DOUBLON) return { ok: false, error: await messageDoublon(terme) };
  if (error) return { ok: false, error: "Impossible d'ajouter le terme." };
  return { ok: true };
}

// Crée un groupe à partir d'une liste libre (virgules ou retours à la ligne).
// Le numéro de groupe n'a aucune signification métier : on prend le suivant.
export async function creerGroupeSynonymes(brut: string): Promise<ActionResult & { groupe?: number }> {
  await requireAdmin();

  const termes = [
    ...new Set(
      brut
        .split(/[\n,;]+/)
        .map(normaliserTerme)
        .filter((t) => t.length > 0),
    ),
  ];
  if (termes.length < 2) {
    return { ok: false, error: "Un groupe a besoin d'au moins 2 termes (séparés par des virgules)." };
  }
  for (const t of termes) {
    const erreur = validerTerme(t);
    if (erreur) return { ok: false, error: `« ${t} » : ${erreur.toLowerCase()}` };
  }

  const { data: dernier } = await supabaseAdmin
    .from("synonymes")
    .select("groupe")
    .order("groupe", { ascending: false })
    .limit(1)
    .maybeSingle();
  const groupe = (dernier?.groupe ?? 0) + 1;

  const { error } = await supabaseAdmin
    .from("synonymes")
    .insert(termes.map((terme) => ({ groupe, terme })));
  if (error?.code === DOUBLON) {
    // Insert en bloc : si un seul terme existe déjà, rien n'est écrit. On
    // désigne le fautif au lieu de laisser l'admin deviner.
    const { data } = await supabaseAdmin.from("synonymes").select("terme, groupe").in("terme", termes);
    const existant = (data ?? [])[0];
    return {
      ok: false,
      error: existant
        ? `« ${existant.terme} » est déjà dans le groupe ${existant.groupe}. Ajoute plutôt les autres termes à ce groupe.`
        : "Un des termes existe déjà.",
    };
  }
  if (error) return { ok: false, error: "Impossible de créer le groupe." };
  return { ok: true, groupe };
}

export async function supprimerTermeSynonyme(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("synonymes").delete().eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  return { ok: true };
}
