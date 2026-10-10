"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { STATUTS_COMMANDE_EFFECTUEE, STATUTS_COMMANDE_EN_ATTENTE } from "@/lib/commandes";
import { estVendeurSacAdo, VENDEUR_SACADO_ID } from "@/lib/vendeurs/constants";
import { labelsVariantes, un, creerDemandePourVendeur } from "@/lib/preparation-creer";
import { refPreparation, numeroWhatsapp } from "@/lib/preparations";
import { jetonPreparation } from "@/lib/preparation-auth";
import { origineSite } from "@/lib/site-url";
import { rendreModele } from "@/lib/messages/modeles";
import { formatPrice } from "@/lib/format";
import { journaliserNotification } from "@/lib/messages/journal";

// Lot 2/3 de TACHE_commandes_fournisseurs_promo_express.md : une seule
// fonction, partagée entre la page « Produits de la commande » (ids choisis à
// la main) et la page « Achats » (toutes les commandes effectuées non
// livrées). Les kits ne comptent pas comme des articles à part : depuis la
// migration 0100, chaque ligne de commande_items est déjà le composant réel
// (produit_id = composant), avec kit_id/kit_nom pour le regroupement visuel.

export type ArticleAchat = {
  commandeItemId: number;
  commandeId: number;
  clientNom: string;
  modeLivraison: string | null;
  dateLivraisonPrevue: string | null;
  statutCommande: string;
  produitId: number;
  produitNom: string;
  produitPhoto: string | null;
  varianteId: number | null;
  varianteLabel: string | null;
  quantite: number;
  prixUnitaire: number;
  prixAchatUnitaire: number | null;
  kitGroupeId: string | null;
  kitNom: string | null;
  vendeurNom: string;
  // Déjà rattaché à une demande de préparation (table demande_preparation_items,
  // commande_item_id UNIQUE) : on ne recrée jamais une 2e demande pour le même
  // article, on renvoie plutôt le lien de celle qui existe déjà.
  demandeExistante: { id: number; ref: string; statut: string; recupereeLe: string | null } | null;
};

export type GroupeFournisseur = {
  vendeurId: string;
  vendeurNom: string;
  vendeurTelephone: string | null;
  articles: ArticleAchat[];
  totalAchat: number;
  nbArticles: number;
  // Pour trier par urgence : le plus proche de maintenant d'abord.
  prochaineLivraisonMs: number;
};

export type ArticlesParFournisseur = {
  fournisseurs: GroupeFournisseur[];
  // Articles dont le vendeur est SacAdo (stock propre) : rien à commander.
  stockSacAdo: ArticleAchat[];
  // Tous les articles à plat (fournisseurs + stock SacAdo), pour l'onglet
  // "Produits" (Lot 2c) qui ne distingue pas par fournisseur.
  tousLesArticles: ArticleAchat[];
};

type FiltreArticles =
  | { commandeIds: number[] }
  | { commandeIds?: undefined; inclureEnAttente: boolean };

function dateUrgence(a: ArticleAchat): number {
  if (a.modeLivraison === "24h") return 0;
  if (a.dateLivraisonPrevue) return new Date(a.dateLivraisonPrevue).getTime();
  return Number.POSITIVE_INFINITY;
}

export async function getArticlesParFournisseur(filtre: FiltreArticles): Promise<ArticlesParFournisseur> {
  await requireAdmin();

  type Row = {
    id: number;
    commande_id: number;
    produit_id: number;
    variante_id: number | null;
    quantite: number;
    prix_unitaire: number;
    prix_achat_unitaire: number | null;
    kit_groupe_id: string | null;
    kit_nom: string | null;
    produit: { nom: string; photo: string | null; vendeur_id: string | null } | { nom: string; photo: string | null; vendeur_id: string | null }[] | null;
    commande: {
      id: number;
      statut: string;
      mode_livraison: string | null;
      date_livraison_prevue: string | null;
      client: { nom: string } | { nom: string }[] | null;
    } | {
      id: number;
      statut: string;
      mode_livraison: string | null;
      date_livraison_prevue: string | null;
      client: { nom: string } | { nom: string }[] | null;
    }[] | null;
  };

  let query = supabaseAdmin
    .from("commande_items")
    .select(
      `id, commande_id, produit_id, variante_id, quantite, prix_unitaire, prix_achat_unitaire,
       kit_groupe_id, kit_nom,
       produit:produits(nom, photo, vendeur_id),
       commande:commandes!inner(id, statut, mode_livraison, date_livraison_prevue, client:clients(nom))`,
    );

  if (filtre.commandeIds) {
    if (filtre.commandeIds.length === 0) return { fournisseurs: [], stockSacAdo: [], tousLesArticles: [] };
    query = query.in("commande_id", filtre.commandeIds);
  } else {
    const statuts = filtre.inclureEnAttente
      ? [...STATUTS_COMMANDE_EFFECTUEE, ...STATUTS_COMMANDE_EN_ATTENTE]
      : STATUTS_COMMANDE_EFFECTUEE;
    // "pas encore livrées" : on retire 'livree' même en mode "toutes".
    query = query.in("commande.statut", statuts.filter((s) => s !== "livree")).eq("commande.est_test", false);
  }

  const { data, error } = await query;
  if (error) return { fournisseurs: [], stockSacAdo: [], tousLesArticles: [] };

  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return { fournisseurs: [], stockSacAdo: [], tousLesArticles: [] };

  const varianteIds = rows.map((r) => r.variante_id).filter((v): v is number => v != null);
  const labels = await labelsVariantes(varianteIds);

  const { data: dejaRows } = await supabaseAdmin
    .from("demande_preparation_items")
    .select("commande_item_id, demande_id, demande:demandes_preparation(statut, recuperee_le)")
    .in(
      "commande_item_id",
      rows.map((r) => r.id),
    );
  type DejaRow = {
    commande_item_id: number;
    demande_id: number;
    demande: { statut: string; recuperee_le: string | null } | { statut: string; recuperee_le: string | null }[] | null;
  };
  const dejaParItem = new Map<number, { id: number; ref: string; statut: string; recupereeLe: string | null }>();
  for (const d of (dejaRows ?? []) as unknown as DejaRow[]) {
    const demande = un(d.demande);
    dejaParItem.set(d.commande_item_id, {
      id: d.demande_id,
      ref: refPreparation(d.demande_id),
      statut: demande?.statut ?? "a_preparer",
      recupereeLe: demande?.recuperee_le ?? null,
    });
  }

  const articles: (ArticleAchat & { vendeurId: string | null })[] = rows.map((row) => {
    const produit = un(row.produit);
    const commande = un(row.commande);
    const client = commande ? un(commande.client) : null;
    return {
      commandeItemId: row.id,
      commandeId: row.commande_id,
      clientNom: client?.nom ?? "—",
      modeLivraison: commande?.mode_livraison ?? null,
      dateLivraisonPrevue: commande?.date_livraison_prevue ?? null,
      statutCommande: commande?.statut ?? "",
      produitId: row.produit_id,
      produitNom: produit?.nom ?? "Produit supprimé",
      produitPhoto: produit?.photo ?? null,
      varianteId: row.variante_id,
      varianteLabel: row.variante_id != null ? (labels.get(row.variante_id) ?? null) : null,
      quantite: row.quantite,
      prixUnitaire: row.prix_unitaire,
      prixAchatUnitaire: row.prix_achat_unitaire,
      kitGroupeId: row.kit_groupe_id,
      kitNom: row.kit_nom,
      demandeExistante: dejaParItem.get(row.id) ?? null,
      vendeurId: produit?.vendeur_id ?? null,
      vendeurNom: "",
    };
  });

  const stockSacAdo = articles.filter((a) => a.vendeurId == null || estVendeurSacAdo(a.vendeurId));
  const aCommander = articles.filter((a) => a.vendeurId != null && !estVendeurSacAdo(a.vendeurId));
  stockSacAdo.forEach((a) => (a.vendeurNom = "Stock SacAdo"));

  const vendeurIds = [...new Set(aCommander.map((a) => a.vendeurId as string))];
  const { data: vendeursRows } = vendeurIds.length
    ? await supabaseAdmin.from("vendeurs").select("id, nom_boutique, contact_telephone").in("id", vendeurIds)
    : { data: [] };
  const vendeurParId = new Map((vendeursRows ?? []).map((v) => [v.id as string, v as { nom_boutique: string; contact_telephone: string | null }]));
  aCommander.forEach((a) => (a.vendeurNom = vendeurParId.get(a.vendeurId as string)?.nom_boutique ?? "Fournisseur"));

  const parVendeur = new Map<string, GroupeFournisseur>();
  for (const a of aCommander) {
    const vendeurId = a.vendeurId as string;
    let groupe = parVendeur.get(vendeurId);
    if (!groupe) {
      const v = vendeurParId.get(vendeurId);
      groupe = {
        vendeurId,
        vendeurNom: v?.nom_boutique ?? "Fournisseur",
        vendeurTelephone: v?.contact_telephone ?? null,
        articles: [],
        totalAchat: 0,
        nbArticles: 0,
        prochaineLivraisonMs: Number.POSITIVE_INFINITY,
      };
      parVendeur.set(vendeurId, groupe);
    }
    groupe.articles.push(a);
    groupe.totalAchat += (a.prixAchatUnitaire ?? 0) * a.quantite;
    groupe.nbArticles += a.quantite;
    groupe.prochaineLivraisonMs = Math.min(groupe.prochaineLivraisonMs, dateUrgence(a));
  }

  const fournisseurs = [...parVendeur.values()].sort((a, b) => a.prochaineLivraisonMs - b.prochaineLivraisonMs);
  return { fournisseurs, stockSacAdo, tousLesArticles: [...aCommander, ...stockSacAdo] };
}

// Ligne `- 2 x Cahier 200 pages (bleu)` (Lot 2e), avec le prix d'achat en plus
// si l'interrupteur "Inclure les prix d'achat" est activé.
function ligneArticle(a: ArticleAchat, avecPrix: boolean): string {
  const label = a.varianteLabel ? `${a.produitNom} (${a.varianteLabel})` : a.produitNom;
  const prix = avecPrix && a.prixAchatUnitaire != null ? ` : ${formatPrice(a.prixAchatUnitaire)}` : "";
  return `- ${a.quantite} x ${label}${prix}`;
}

// Aperçu modifiable (Lot 2c) : avant toute création de demande, pour que
// l'admin relise avant d'envoyer. {reference} et {lien_bon} sont encore des
// jalons — remplacés par les vraies valeurs seulement à la validation.
export async function previsualiserMessageFournisseur(input: {
  vendeurNom: string;
  articles: ArticleAchat[];
  avecPrix: boolean;
}): Promise<string> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("modeles_messages")
    .select("contenu")
    .eq("code", "commande_fournisseur")
    .eq("canal", "whatsapp")
    .eq("actif", true)
    .maybeSingle();
  const modele =
    (data?.contenu as string | undefined) ??
    "Bonjour {fournisseur}, c'est SacAdo.\nVoici notre commande {reference} :\n{liste_articles}\n\nLes photos de chaque article sont ici : {lien_bon}\nDites-nous quand tout est prêt, on passe récupérer.";
  return rendreModele(modele, {
    fournisseur: input.vendeurNom,
    reference: "(numéro attribué à l'envoi)",
    liste_articles: input.articles.map((a) => ligneArticle(a, input.avecPrix)).join("\n"),
    lien_bon: "(lien généré à l'envoi)",
  });
}

// Article déjà pris dans une demande existante (Lot 2c) : on renvoie
// simplement son lien, sans en recréer une.
export async function obtenirLienBon(demandeId: number): Promise<string> {
  await requireAdmin();
  return `${await origineSite()}/preparation/${demandeId}?t=${jetonPreparation(demandeId)}`;
}

export type ResultatEnvoiFournisseur =
  | { ok: true; reference: string; lien: string; numeroWhatsapp: string | null }
  | { ok: false; error: string };

// « Valider et ouvrir WhatsApp » (Lot 2c/3) : crée (ou réutilise) la demande
// de préparation du fournisseur, limitée aux commandes sélectionnées, puis
// renvoie le lien signé du bon — rien ne part sur WhatsApp avant ce clic.
export async function validerEtEnvoyerFournisseur(
  vendeurId: string,
  commandeIds: number[],
  vendeurTelephone: string | null,
): Promise<ResultatEnvoiFournisseur> {
  await requireAdmin();
  if (vendeurId === VENDEUR_SACADO_ID) {
    return { ok: false, error: "Le vendeur SacAdo n'a pas de préparation externe." };
  }

  const res = await creerDemandePourVendeur(vendeurId, "manuel", { commandeIds });
  let demandeId: number;
  if (res.ok) {
    demandeId = res.id;
  } else if (res.error === "Aucun article en attente pour ce vendeur.") {
    // Tous les articles affichés sont déjà dans une demande existante —
    // on ne recrée rien, on retrouve celle à laquelle ils appartiennent.
    const { data } = await supabaseAdmin
      .from("demande_preparation_items")
      .select("demande_id, demandes_preparation!inner(vendeur_id)")
      .eq("demandes_preparation.vendeur_id", vendeurId)
      .in("commande_id", commandeIds)
      .order("demande_id", { ascending: false })
      .limit(1);
    const ligne = (data ?? [])[0] as { demande_id: number } | undefined;
    if (!ligne) return { ok: false, error: res.error };
    demandeId = ligne.demande_id;
  } else {
    return { ok: false, error: res.error };
  }

  const lien = `${await origineSite()}/preparation/${demandeId}?t=${jetonPreparation(demandeId)}`;
  await journaliserNotification({
    clientId: null,
    commandeId: commandeIds[0] ?? null,
    canal: "whatsapp",
    type: "commande_fournisseur",
    statut: "envoye",
    detail: refPreparation(demandeId),
  });

  return {
    ok: true,
    reference: refPreparation(demandeId),
    lien,
    numeroWhatsapp: numeroWhatsapp(vendeurTelephone),
  };
}
