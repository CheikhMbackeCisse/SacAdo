"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "./produits-actions";
import type { ScoreDetails } from "@/lib/supabase/types";

// Panneau d'administration de l'algorithme de classement
// (TACHE_algorithme_classement.md §6).

// ---------------------------------------------------------------------------
// Consultation du classement + décomposition (§6.3)
// ---------------------------------------------------------------------------
export type LigneScore = {
  id: number;
  nom: string;
  score_global: number;
  details: ScoreDetails | null;
};

export async function getClassementApercu(limit = 20): Promise<LigneScore[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("produits")
    .select("id, nom, score_global, score_details")
    .eq("statut_publication", "publie")
    .order("score_global", { ascending: false })
    .order("id", { ascending: true })
    .limit(limit);
  return (data ?? []).map((p) => ligne(p));
}

export async function chercherProduitScore(terme: string): Promise<LigneScore[]> {
  await requireAdmin();
  const t = terme.trim().slice(0, 60);
  if (t.length < 2) return [];
  const { data } = await supabaseAdmin
    .from("produits")
    .select("id, nom, score_global, score_details")
    .ilike("nom", `%${t}%`)
    .order("score_global", { ascending: false })
    .limit(20);
  return (data ?? []).map((p) => ligne(p));
}

function ligne(p: Record<string, unknown>): LigneScore {
  return {
    id: p.id as number,
    nom: p.nom as string,
    score_global: Number(p.score_global ?? 0),
    details: (p.score_details as ScoreDetails | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Poids + interrupteur de personnalisation (§6.1, §6.5)
// ---------------------------------------------------------------------------
export type ConfigClassement = {
  performance: number;
  saisonnalite: number;
  marge: number;
  fraicheur: number;
  affinite: number;
  persoActive: boolean;
};

const CLES: Record<keyof Omit<ConfigClassement, "persoActive">, string> = {
  performance: "poids_performance",
  saisonnalite: "poids_saisonnalite",
  marge: "poids_marge",
  fraicheur: "poids_fraicheur",
  affinite: "poids_affinite",
};

export async function getConfigClassement(): Promise<ConfigClassement> {
  await requireAdmin();
  const { data } = await supabaseAdmin.from("config_classement").select("cle, valeur");
  const m = new Map((data ?? []).map((r) => [r.cle as string, Number(r.valeur)]));
  return {
    performance: m.get("poids_performance") ?? 0.45,
    saisonnalite: m.get("poids_saisonnalite") ?? 0.3,
    marge: m.get("poids_marge") ?? 0.15,
    fraicheur: m.get("poids_fraicheur") ?? 0.1,
    affinite: m.get("poids_affinite") ?? 0.6,
    persoActive: (m.get("perso_active") ?? 1) !== 0,
  };
}

export async function enregistrerPoids(
  poids: Pick<ConfigClassement, "performance" | "saisonnalite" | "marge" | "fraicheur" | "affinite">,
): Promise<ActionResult> {
  await requireAdmin();
  const lignes = (Object.keys(CLES) as (keyof typeof CLES)[]).map((k) => ({
    cle: CLES[k],
    valeur: borne(poids[k]),
    maj_le: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin
    .from("config_classement")
    .upsert(lignes, { onConflict: "cle" });
  if (error) return { ok: false, error: "Impossible d'enregistrer les poids." };
  return { ok: true };
}

function borne(v: number): number {
  if (!Number.isFinite(v) || v < 0) return 0;
  return Math.min(5, Math.round(v * 1000) / 1000);
}

export async function basculerPersonnalisation(actif: boolean): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("config_classement")
    .upsert({ cle: "perso_active", valeur: actif ? 1 : 0, maj_le: new Date().toISOString() }, { onConflict: "cle" });
  if (error) return { ok: false, error: "Impossible de basculer la personnalisation." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Aperçu avant/après (§6.2)
// ---------------------------------------------------------------------------
export type LigneApercu = {
  produitId: number;
  nom: string;
  scoreActuel: number;
  scoreApercu: number;
  rangActuel: number;
  rangApercu: number;
};

export async function getApercu(
  poids: Pick<ConfigClassement, "performance" | "saisonnalite" | "marge" | "fraicheur">,
): Promise<LigneApercu[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.rpc("apercu_classement", {
    p_poids: {
      performance: borne(poids.performance),
      saisonnalite: borne(poids.saisonnalite),
      marge: borne(poids.marge),
      fraicheur: borne(poids.fraicheur),
    },
  });
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    produitId: r.produit_id as number,
    nom: r.nom as string,
    scoreActuel: Number(r.score_actuel ?? 0),
    scoreApercu: Number(r.score_apercu ?? 0),
    rangActuel: Number(r.rang_actuel ?? 0),
    rangApercu: Number(r.rang_apercu ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Recalcul (§6.1)
// ---------------------------------------------------------------------------
export type RecalculResult = ActionResult & { calculeLe?: string };

export async function recalculerScoreGlobal(): Promise<RecalculResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.rpc("calculer_score_global");
  if (error) return { ok: false, error: `Le recalcul a échoué : ${error.message}` };
  return { ok: true, calculeLe: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Épinglage / exclusion (§6.4)
// ---------------------------------------------------------------------------
export type LigneManuel = {
  produitId: number;
  nom: string;
  position: number | null;
  exclu: boolean;
};

export async function getClassementManuel(): Promise<LigneManuel[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("classement_manuel")
    .select("produit_id, position, exclu, produits(nom)")
    .order("position", { ascending: true, nullsFirst: false });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    produitId: r.produit_id as number,
    nom: ((r.produits as { nom?: string } | null)?.nom ?? `#${r.produit_id}`) as string,
    position: (r.position ?? null) as number | null,
    exclu: Boolean(r.exclu),
  }));
}

export async function definirClassementManuel(
  produitId: number,
  champs: { position?: number | null; exclu?: boolean },
): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(produitId)) return { ok: false, error: "Produit invalide." };
  const patch: Record<string, unknown> = { produit_id: produitId };
  if ("position" in champs) {
    const p = champs.position;
    patch.position = p == null ? null : Math.max(1, Math.min(60, Math.round(p)));
  }
  if ("exclu" in champs) patch.exclu = Boolean(champs.exclu);
  const { error } = await supabaseAdmin
    .from("classement_manuel")
    .upsert(patch, { onConflict: "produit_id" });
  if (error) return { ok: false, error: "Impossible d'enregistrer." };
  return { ok: true };
}

export async function retirerClassementManuel(produitId: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("classement_manuel")
    .delete()
    .eq("produit_id", produitId);
  if (error) return { ok: false, error: "Impossible de retirer." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Saisons (§6.6)
// ---------------------------------------------------------------------------
export type SaisonAdmin = {
  id: number;
  nom: string;
  debut: string;
  fin: string;
  actif: boolean;
  coefficients: { categorieId: number; categorieNom: string; coefficient: number }[];
};

export async function getSaisonsAdmin(): Promise<{
  saisons: SaisonAdmin[];
  categories: { id: number; nom: string }[];
}> {
  await requireAdmin();
  const [{ data: saisons }, { data: coefs }, { data: cats }] = await Promise.all([
    supabaseAdmin.from("saisons").select("*").order("debut", { ascending: true }),
    supabaseAdmin.from("saisons_categories").select("saison_id, categorie_id, coefficient, categories(nom)"),
    supabaseAdmin.from("categories").select("id, nom").neq("slug", "kits").order("ordre"),
  ]);
  const parSaison = new Map<number, SaisonAdmin["coefficients"]>();
  for (const c of coefs ?? []) {
    const arr = parSaison.get(c.saison_id as number) ?? [];
    arr.push({
      categorieId: c.categorie_id as number,
      categorieNom: ((c.categories as { nom?: string } | null)?.nom ?? "") as string,
      coefficient: Number(c.coefficient),
    });
    parSaison.set(c.saison_id as number, arr);
  }
  return {
    saisons: (saisons ?? []).map((s) => ({
      id: s.id as number,
      nom: s.nom as string,
      debut: s.debut as string,
      fin: s.fin as string,
      actif: Boolean(s.actif),
      coefficients: parSaison.get(s.id as number) ?? [],
    })),
    categories: (cats ?? []).map((c) => ({ id: c.id as number, nom: c.nom as string })),
  };
}

export async function enregistrerSaison(
  saison: { id?: number; nom: string; debut: string; fin: string; actif: boolean },
): Promise<ActionResult & { id?: number }> {
  await requireAdmin();
  const nom = saison.nom.trim().slice(0, 60);
  if (!nom) return { ok: false, error: "Le nom est requis." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(saison.debut) || !/^\d{4}-\d{2}-\d{2}$/.test(saison.fin)) {
    return { ok: false, error: "Dates invalides." };
  }
  const payload = { nom, debut: saison.debut, fin: saison.fin, actif: saison.actif };
  if (saison.id) {
    const { error } = await supabaseAdmin.from("saisons").update(payload).eq("id", saison.id);
    if (error) return { ok: false, error: "Impossible d'enregistrer la saison." };
    return { ok: true, id: saison.id };
  }
  const { data, error } = await supabaseAdmin.from("saisons").insert(payload).select("id").single();
  if (error || !data) return { ok: false, error: "Impossible de créer la saison." };
  return { ok: true, id: data.id as number };
}

export async function supprimerSaison(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("saisons").delete().eq("id", id);
  if (error) return { ok: false, error: "Impossible de supprimer." };
  return { ok: true };
}

export async function definirCoefficientSaison(
  saisonId: number,
  categorieId: number,
  coefficient: number | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (coefficient == null || coefficient <= 0) {
    const { error } = await supabaseAdmin
      .from("saisons_categories")
      .delete()
      .eq("saison_id", saisonId)
      .eq("categorie_id", categorieId);
    if (error) return { ok: false, error: "Impossible de retirer le coefficient." };
    return { ok: true };
  }
  const { error } = await supabaseAdmin
    .from("saisons_categories")
    .upsert(
      { saison_id: saisonId, categorie_id: categorieId, coefficient: Math.min(5, Math.round(coefficient * 100) / 100) },
      { onConflict: "saison_id,categorie_id" },
    );
  if (error) return { ok: false, error: "Impossible d'enregistrer le coefficient." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rendement de l'exploration (§6.7)
// ---------------------------------------------------------------------------
export type RendementExploration = {
  origine: string;
  impressions: number;
  ajoutsPanier: number;
  taux: number;
};

export async function getRendementExploration(jours = 30): Promise<RendementExploration[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.rpc("rendement_exploration", { p_jours: jours });
  if (error) return [];
  return (data ?? []).map((r: Record<string, unknown>) => ({
    origine: r.origine as string,
    impressions: Number(r.impressions ?? 0),
    ajoutsPanier: Number(r.ajouts_panier ?? 0),
    taux: Number(r.taux ?? 0),
  }));
}
