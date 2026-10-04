"use server";

import QRCode from "qrcode";
import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";
import type { ActionResult } from "./produits-actions";

// Tableau « Trafic » (PROMPT_ADMIN_V2 Lot 3), lu sur les tables posées par
// PROMPT_CLIENT_V2 Lot 5 (lib/trafic/mesure.ts). Agrégation en JS, pas en SQL,
// sauf pour le graphe par jour (visites_par_jour, migration 0109) : au volume
// d'une boutique comme SacAdo, quelques requêtes bornées par date restent
// largement plus simples à faire évoluer qu'une fonction SQL par écran, pour
// un coût négligeable. `LIMITE` protège juste contre un volume imprévu.
const LIMITE = 20000;

export type Periode = "aujourdhui" | "7j" | "30j";

function depuisPourPeriode(periode: Periode): string {
  const debut = new Date();
  if (periode === "aujourdhui") {
    debut.setHours(0, 0, 0, 0);
  } else if (periode === "7j") {
    debut.setDate(debut.getDate() - 7);
  } else {
    debut.setDate(debut.getDate() - 30);
  }
  return debut.toISOString();
}

function top<T>(m: Map<T, number>, n: number): [T, number][] {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// ---------------------------------------------------------------------------
// 1. Visites
// ---------------------------------------------------------------------------

export type ResumeVisites = {
  visiteursUniques: number;
  pagesVues: number;
  enCeMoment: number;
  parJour: { jour: string; visiteursUniques: number; pagesVues: number }[];
};

export async function getResumeVisites(periode: Periode): Promise<ResumeVisites> {
  await requireAdmin();
  const depuis = depuisPourPeriode(periode);
  const ilYA5Min = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const [{ data: sessions }, { count: pagesVues }, { count: enCeMoment }, { data: parJour }] = await Promise.all([
    supabaseAdmin.from("visites_evenements").select("session_id").gte("cree_le", depuis).limit(LIMITE),
    supabaseAdmin
      .from("visites_evenements")
      .select("id", { count: "exact", head: true })
      .eq("type", "page_vue")
      .gte("cree_le", depuis),
    supabaseAdmin
      .from("visites_sessions")
      .select("session_id", { count: "exact", head: true })
      .gte("derniere_activite_le", ilYA5Min),
    supabaseAdmin.rpc("visites_par_jour", { p_depuis: depuis }),
  ]);

  const visiteursUniques = new Set((sessions ?? []).map((s) => s.session_id as string)).size;

  return {
    visiteursUniques,
    pagesVues: pagesVues ?? 0,
    enCeMoment: enCeMoment ?? 0,
    parJour: ((parJour ?? []) as { jour: string; visiteurs_uniques: number; pages_vues: number }[]).map((r) => ({
      jour: r.jour,
      visiteursUniques: Number(r.visiteurs_uniques),
      pagesVues: Number(r.pages_vues),
    })),
  };
}

// ---------------------------------------------------------------------------
// 2. Sources
// ---------------------------------------------------------------------------

export type StatSource = { sourceType: string; visites: number; commandes: number };

async function sessionsAvecCommandeDepuis(depuis: string): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("visites_evenements")
    .select("session_id")
    .eq("type", "commande_validee")
    .gte("cree_le", depuis)
    .limit(LIMITE);
  return new Set((data ?? []).map((e) => e.session_id as string));
}

export async function getSources(periode: Periode): Promise<StatSource[]> {
  await requireAdmin();
  const depuis = depuisPourPeriode(periode);

  const [{ data: sessions }, sessionsAvecCommande] = await Promise.all([
    supabaseAdmin.from("visites_sessions").select("session_id, source_type").gte("cree_le", depuis).limit(LIMITE),
    sessionsAvecCommandeDepuis(depuis),
  ]);

  const parSource = new Map<string, StatSource>();
  for (const s of sessions ?? []) {
    const key = s.source_type as string;
    const entree = parSource.get(key) ?? { sourceType: key, visites: 0, commandes: 0 };
    entree.visites += 1;
    if (sessionsAvecCommande.has(s.session_id as string)) entree.commandes += 1;
    parSource.set(key, entree);
  }
  return [...parSource.values()].sort((a, b) => b.visites - a.visites);
}

// ---------------------------------------------------------------------------
// 3. Liens et QR codes
// ---------------------------------------------------------------------------

export type LienSuivi = {
  id: number;
  code: string;
  utmSource: string;
  utmCampaign: string;
  libelle: string | null;
  url: string;
  visites: number;
  commandes: number;
};

const CODE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function urlLien(utmSource: string, utmCampaign: string): string {
  const params = new URLSearchParams({ utm_source: utmSource, utm_campaign: utmCampaign });
  return `${SITE_URL}/?${params.toString()}`;
}

export async function getLiensSuivi(periode: Periode): Promise<LienSuivi[]> {
  await requireAdmin();
  const depuis = depuisPourPeriode(periode);

  const [{ data: liens }, { data: sessions }, sessionsAvecCommande] = await Promise.all([
    supabaseAdmin.from("visites_liens").select("*").order("cree_le", { ascending: false }),
    supabaseAdmin
      .from("visites_sessions")
      .select("session_id, lien_id")
      .not("lien_id", "is", null)
      .gte("cree_le", depuis)
      .limit(LIMITE),
    sessionsAvecCommandeDepuis(depuis),
  ]);

  const visitesParLien = new Map<number, number>();
  const commandesParLien = new Map<number, number>();
  for (const s of sessions ?? []) {
    const lienId = s.lien_id as number;
    visitesParLien.set(lienId, (visitesParLien.get(lienId) ?? 0) + 1);
    if (sessionsAvecCommande.has(s.session_id as string)) {
      commandesParLien.set(lienId, (commandesParLien.get(lienId) ?? 0) + 1);
    }
  }

  return (liens ?? []).map((l) => ({
    id: l.id as number,
    code: l.code as string,
    utmSource: l.utm_source as string,
    utmCampaign: l.utm_campaign as string,
    libelle: l.libelle as string | null,
    url: urlLien(l.utm_source as string, l.utm_campaign as string),
    visites: visitesParLien.get(l.id as number) ?? 0,
    commandes: commandesParLien.get(l.id as number) ?? 0,
  }));
}

export type CreerLienInput = { code: string; utmSource: string; libelle: string | null };

export async function creerLienSuivi(input: CreerLienInput): Promise<ActionResult> {
  await requireAdmin();
  const code = input.code.trim().toLowerCase();
  const utmSource = input.utmSource.trim().toLowerCase();
  if (!CODE_REGEX.test(code) || code.length > 60) {
    return { ok: false, error: "Le code doit être en minuscules, chiffres et tirets (ex. affiche-lycee-delafosse)." };
  }
  if (!utmSource || utmSource.length > 60) return { ok: false, error: "La source est requise." };

  const { error } = await supabaseAdmin.from("visites_liens").insert({
    code,
    utm_source: utmSource,
    utm_campaign: code,
    libelle: input.libelle?.trim().slice(0, 150) || null,
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "Ce code existe déjà." : "Impossible de créer ce lien." };
  }
  return { ok: true };
}

// QR en PNG (data URL), généré à la demande — pas stocké, le lien suffit à le
// régénérer à l'identique.
export async function genererQrLien(utmSource: string, utmCampaign: string): Promise<string> {
  await requireAdmin();
  return QRCode.toDataURL(urlLien(utmSource, utmCampaign), { width: 512, margin: 2 });
}

// ---------------------------------------------------------------------------
// 4. Parcours d'achat
// ---------------------------------------------------------------------------

export type EtapeFunnel = { etape: string; sessions: number; taux: number };

const TYPES_FUNNEL = ["page_vue", "produit_vu", "ajout_panier", "debut_commande"] as const;

export async function getParcoursAchat(periode: Periode): Promise<EtapeFunnel[]> {
  await requireAdmin();
  const depuis = depuisPourPeriode(periode);

  const parType = new Map<string, Set<string>>();
  for (const type of TYPES_FUNNEL) {
    const { data } = await supabaseAdmin
      .from("visites_evenements")
      .select("session_id")
      .eq("type", type)
      .gte("cree_le", depuis)
      .limit(LIMITE);
    parType.set(type, new Set((data ?? []).map((e) => e.session_id as string)));
  }

  const { data: eventsCommande } = await supabaseAdmin
    .from("visites_evenements")
    .select("session_id, commande_id")
    .eq("type", "commande_validee")
    .gte("cree_le", depuis)
    .limit(LIMITE);
  const sessionsCommandeValidee = new Set((eventsCommande ?? []).map((e) => e.session_id as string));

  const commandeIds = [...new Set((eventsCommande ?? []).map((e) => e.commande_id as number | null).filter((v): v is number => v != null))];
  const sessionsPayees = new Set<string>();
  if (commandeIds.length > 0) {
    const { data: commandes } = await supabaseAdmin
      .from("commandes")
      .select("id, statut, mode_paiement, statut_paiement")
      .in("id", commandeIds)
      .eq("est_test", false);
    const commandesPayees = new Set(
      (commandes ?? [])
        .filter((c) => c.statut !== "annulee" && (c.mode_paiement !== "wave" || c.statut_paiement === "payee"))
        .map((c) => c.id as number),
    );
    for (const e of eventsCommande ?? []) {
      if (e.commande_id != null && commandesPayees.has(e.commande_id as number)) {
        sessionsPayees.add(e.session_id as string);
      }
    }
  }

  const visites = (parType.get("page_vue") ?? new Set()).size;
  const base = visites || 1;
  const etapes: { etape: string; sessions: number }[] = [
    { etape: "Visites", sessions: visites },
    { etape: "Produit vu", sessions: (parType.get("produit_vu") ?? new Set()).size },
    { etape: "Ajout au panier", sessions: (parType.get("ajout_panier") ?? new Set()).size },
    { etape: "Début de commande", sessions: (parType.get("debut_commande") ?? new Set()).size },
    { etape: "Commande validée", sessions: sessionsCommandeValidee.size },
    { etape: "Payée", sessions: sessionsPayees.size },
  ];
  return etapes.map((e) => ({ ...e, taux: Math.round((e.sessions / base) * 1000) / 10 }));
}

// ---------------------------------------------------------------------------
// 5. Paniers non validés
// ---------------------------------------------------------------------------

export type PanierNonValide = {
  sessionId: string;
  montant: number;
  derniereActivite: string;
  source: string;
  produits: { produitId: number; nom: string; quantite: number }[];
  telephone: string | null;
};

const FENETRE_PANIER_HEURES = 72;

export async function getPaniersNonValides(): Promise<PanierNonValide[]> {
  await requireAdmin();
  const depuis = new Date(Date.now() - FENETRE_PANIER_HEURES * 3600 * 1000).toISOString();

  const [{ data: evenementsPanier }, sessionsAvecCommande] = await Promise.all([
    supabaseAdmin
      .from("visites_evenements")
      .select("session_id, type, produit_id, quantite, cree_le")
      .in("type", ["ajout_panier", "retrait_panier"])
      .gte("cree_le", depuis)
      .order("cree_le", { ascending: true })
      .limit(LIMITE),
    sessionsAvecCommandeDepuis(depuis),
  ]);

  type Cumul = { produits: Map<number, number>; derniere: string };
  const parSession = new Map<string, Cumul>();
  for (const e of evenementsPanier ?? []) {
    const sid = e.session_id as string;
    if (sessionsAvecCommande.has(sid)) continue;
    const cumul = parSession.get(sid) ?? { produits: new Map<number, number>(), derniere: e.cree_le as string };
    const delta = (e.type === "ajout_panier" ? 1 : -1) * ((e.quantite as number | null) ?? 1);
    const pid = e.produit_id as number | null;
    if (pid != null) cumul.produits.set(pid, (cumul.produits.get(pid) ?? 0) + delta);
    if ((e.cree_le as string) > cumul.derniere) cumul.derniere = e.cree_le as string;
    parSession.set(sid, cumul);
  }

  const sessionsAvecPanier = [...parSession.entries()].filter(([, c]) => [...c.produits.values()].some((q) => q > 0));
  if (sessionsAvecPanier.length === 0) return [];

  const idsProduits = [...new Set(sessionsAvecPanier.flatMap(([, c]) => [...c.produits.keys()]))];
  const { data: produits } = await supabaseAdmin.from("produits").select("id, nom, prix").in("id", idsProduits);
  const parProduit = new Map((produits ?? []).map((p) => [p.id as number, p as { nom: string; prix: number }]));

  const sessionIds = sessionsAvecPanier.map(([sid]) => sid);
  const { data: infosSessions } = await supabaseAdmin
    .from("visites_sessions")
    .select("session_id, source_type, client_id")
    .in("session_id", sessionIds);
  const parSessionInfo = new Map((infosSessions ?? []).map((s) => [s.session_id as string, s]));

  const idsClients = [
    ...new Set((infosSessions ?? []).map((s) => s.client_id as number | null).filter((v): v is number => v != null)),
  ];
  const { data: clients } = idsClients.length
    ? await supabaseAdmin.from("clients").select("id, telephone").in("id", idsClients)
    : { data: [] as { id: number; telephone: string }[] };
  const parClient = new Map((clients ?? []).map((c) => [c.id as number, c.telephone as string]));

  return sessionsAvecPanier
    .map(([sid, cumul]) => {
      const lignes = [...cumul.produits.entries()]
        .filter(([, q]) => q > 0)
        .map(([pid, q]) => ({ produitId: pid, nom: parProduit.get(pid)?.nom ?? "Produit supprimé", quantite: q }));
      const montant = lignes.reduce((sum, l) => sum + l.quantite * (parProduit.get(l.produitId)?.prix ?? 0), 0);
      const info = parSessionInfo.get(sid);
      const telephone = info?.client_id != null ? parClient.get(info.client_id as number) ?? null : null;
      return {
        sessionId: sid,
        montant,
        derniereActivite: cumul.derniere,
        source: (info?.source_type as string | undefined) ?? "direct",
        produits: lignes,
        telephone,
      };
    })
    .sort((a, b) => (a.derniereActivite < b.derniereActivite ? 1 : -1));
}

// ---------------------------------------------------------------------------
// 6. Infos techniques
// ---------------------------------------------------------------------------

export type InfosTechniques = {
  appareils: { appareil: string; sessions: number }[];
  navigateurs: { navigateur: string; sessions: number }[];
  appInstallee: number;
  pagesPlusVues: { page: string; vues: number }[];
  produitsPlusVus: { produitId: number; nom: string; vues: number }[];
  pages404: { page: string; vues: number }[];
};

export async function getInfosTechniques(periode: Periode): Promise<InfosTechniques> {
  await requireAdmin();
  const depuis = depuisPourPeriode(periode);

  const [{ data: sessions }, { data: pagesVues }, { data: produitsVus }, { data: pages404 }] = await Promise.all([
    supabaseAdmin.from("visites_sessions").select("appareil, navigateur, app_installee").gte("cree_le", depuis).limit(LIMITE),
    supabaseAdmin.from("visites_evenements").select("page").eq("type", "page_vue").gte("cree_le", depuis).limit(LIMITE),
    supabaseAdmin.from("visites_evenements").select("produit_id").eq("type", "produit_vu").gte("cree_le", depuis).limit(LIMITE),
    supabaseAdmin.from("visites_evenements").select("page").eq("type", "page_404").gte("cree_le", depuis).limit(LIMITE),
  ]);

  const appareils = new Map<string, number>();
  const navigateurs = new Map<string, number>();
  let appInstallee = 0;
  for (const s of sessions ?? []) {
    const appareil = s.appareil as string;
    appareils.set(appareil, (appareils.get(appareil) ?? 0) + 1);
    const nav = (s.navigateur as string | null) ?? "Autre";
    navigateurs.set(nav, (navigateurs.get(nav) ?? 0) + 1);
    if (s.app_installee) appInstallee += 1;
  }

  const pages = new Map<string, number>();
  for (const e of pagesVues ?? []) {
    const page = (e.page as string | null) ?? "?";
    pages.set(page, (pages.get(page) ?? 0) + 1);
  }

  const compteProduits = new Map<number, number>();
  for (const e of produitsVus ?? []) {
    const pid = e.produit_id as number | null;
    if (pid != null) compteProduits.set(pid, (compteProduits.get(pid) ?? 0) + 1);
  }
  const idsProduits = top(compteProduits, 10).map(([id]) => id);
  const { data: produits } = idsProduits.length
    ? await supabaseAdmin.from("produits").select("id, nom").in("id", idsProduits)
    : { data: [] as { id: number; nom: string }[] };
  const nomParProduit = new Map((produits ?? []).map((p) => [p.id as number, p.nom as string]));

  const compte404 = new Map<string, number>();
  for (const e of pages404 ?? []) {
    const page = (e.page as string | null) ?? "?";
    compte404.set(page, (compte404.get(page) ?? 0) + 1);
  }

  return {
    appareils: top(appareils, 10).map(([appareil, sessions]) => ({ appareil, sessions })),
    navigateurs: top(navigateurs, 10).map(([navigateur, sessions]) => ({ navigateur, sessions })),
    appInstallee,
    pagesPlusVues: top(pages, 10).map(([page, vues]) => ({ page, vues })),
    produitsPlusVus: idsProduits.map((id) => ({ produitId: id, nom: nomParProduit.get(id) ?? "Produit supprimé", vues: compteProduits.get(id) ?? 0 })),
    pages404: top(compte404, 10).map(([page, vues]) => ({ page, vues })),
  };
}
