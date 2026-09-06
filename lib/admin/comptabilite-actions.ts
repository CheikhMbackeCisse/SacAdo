"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculerCommission } from "@/lib/commissions";
import { estCommandeConfirmee } from "@/lib/commandes";
import { CATEGORIES_DEPENSE } from "./comptabilite-constants";
import { estVendeurSacAdo } from "@/lib/vendeurs/constants";
import type { ActionResult } from "./produits-actions";
import type {
  CategorieDepense,
  Commande,
  Commission,
  Depense,
  ModePaiement,
  Produit,
  StatutCommande,
  StatutPaiement,
} from "@/lib/supabase/types";

export type Periode = "jour" | "semaine" | "mois";

// Lundi = début de semaine (convention locale).
function debutPeriode(periode: Periode): Date {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  if (periode === "semaine") {
    debut.setDate(debut.getDate() - ((debut.getDay() + 6) % 7));
  } else if (periode === "mois") {
    debut.setDate(1);
  }
  return debut;
}

type CommandeAllegee = Pick<Commande, "id" | "statut" | "statut_paiement" | "mode_paiement" | "total" | "date">;

// Argent réellement encaissé : Wave dès que payée (webhook), sinon livraison
// seulement une fois livrée (cash remis au livreur). Voir CLAUDE.md §2 et
// GROUPE_B_compte_compta.md §2.
function estEncaissee(c: { statut: StatutCommande; statut_paiement: StatutPaiement | null; mode_paiement: ModePaiement }): boolean {
  if (!estCommandeConfirmee(c.statut)) return false;
  return c.mode_paiement === "wave" ? c.statut_paiement === "payee" : c.statut === "livree";
}

// Créance : commande confirmée, payée à la livraison, pas encore livrée —
// argent qu'on va recevoir mais qui n'est pas encore en caisse.
function estCreance(c: { statut: StatutCommande; mode_paiement: ModePaiement }): boolean {
  return estCommandeConfirmee(c.statut) && c.mode_paiement === "livraison" && c.statut !== "livree";
}

export type DetteVendeur = {
  vendeurId: string;
  nomBoutique: string;
  infosReversement: string | null;
  montant: number;
};

export type RecapComptabilite = {
  periode: Periode;
  totalEntreesPeriode: number;
  totalDepensesPeriode: number;
  soldeReel: number;
  soldeComptable: number;
  creancesEnCours: number;
  dettesVendeursTotal: number;
  dettesVendeurs: DetteVendeur[];
};

export async function getRecapComptabilite(periode: Periode): Promise<RecapComptabilite> {
  await requireAdmin();
  const depuis = debutPeriode(periode);

  const { data: commandesRows } = await supabaseAdmin
    .from("commandes")
    .select("id, statut, statut_paiement, mode_paiement, total, date");
  const commandes = (commandesRows ?? []) as CommandeAllegee[];

  const encaissees = commandes.filter(estEncaissee);
  const totalEntreesTousTemps = encaissees.reduce((s, c) => s + c.total, 0);
  const totalEntreesPeriode = encaissees
    .filter((c) => new Date(c.date) >= depuis)
    .reduce((s, c) => s + c.total, 0);
  const creancesEnCours = commandes.filter(estCreance).reduce((s, c) => s + c.total, 0);

  const { data: depensesRows } = await supabaseAdmin.from("depenses").select("montant, date");
  const depenses = (depensesRows ?? []) as Pick<Depense, "montant" | "date">[];
  const totalDepensesTousTemps = depenses.reduce((s, d) => s + d.montant, 0);
  const totalDepensesPeriodeManuelles = depenses
    .filter((d) => new Date(d.date) >= depuis)
    .reduce((s, d) => s + d.montant, 0);

  const idsEncaissees = encaissees.map((c) => c.id);
  const lignesVendeur = idsEncaissees.length
    ? ((
        await supabaseAdmin
          .from("commande_items")
          .select("commande_id, produit_id, quantite, prix_unitaire, reverse_le")
          .in("commande_id", idsEncaissees)
      ).data ?? [])
    : [];

  const produitIds = [...new Set(lignesVendeur.map((l) => l.produit_id as number))];
  const produitsRows = produitIds.length
    ? (
        await supabaseAdmin
          .from("produits")
          .select("id, vendeur_id, categorie_id, sous_categorie_id")
          .in("id", produitIds)
      ).data
    : [];
  const produitParId = new Map(
    ((produitsRows ?? []) as Pick<Produit, "id" | "vendeur_id" | "categorie_id" | "sous_categorie_id">[]).map((p) => [
      p.id,
      p,
    ]),
  );

  const { data: commissionsRows } = await supabaseAdmin.from("commissions").select("*");
  const commissions = (commissionsRows ?? []) as Commission[];

  const dettesParVendeur = new Map<string, number>();
  let totalReverseTousTemps = 0;
  let totalReversePeriode = 0;

  for (const ligne of lignesVendeur as {
    produit_id: number;
    quantite: number;
    prix_unitaire: number;
    reverse_le: string | null;
  }[]) {
    const produit = produitParId.get(ligne.produit_id);
    // Pas de vendeur, ou vendeur « SacAdo » (produit en propre) : aucune dette.
    if (!produit?.vendeur_id || estVendeurSacAdo(produit.vendeur_id)) continue;
    const { net } = calculerCommission(
      ligne.quantite * ligne.prix_unitaire,
      commissions,
      produit.categorie_id,
      produit.sous_categorie_id,
    );
    if (ligne.reverse_le) {
      totalReverseTousTemps += net;
      if (new Date(ligne.reverse_le) >= depuis) totalReversePeriode += net;
    } else {
      dettesParVendeur.set(produit.vendeur_id, (dettesParVendeur.get(produit.vendeur_id) ?? 0) + net);
    }
  }

  const vendeurIds = [...dettesParVendeur.keys()];
  const vendeursRows = vendeurIds.length
    ? (await supabaseAdmin.from("vendeurs").select("id, nom_boutique, infos_reversement").in("id", vendeurIds)).data
    : [];
  const vendeurParId = new Map(
    ((vendeursRows ?? []) as { id: string; nom_boutique: string; infos_reversement: string | null }[]).map((v) => [
      v.id,
      v,
    ]),
  );

  const dettesVendeurs: DetteVendeur[] = vendeurIds
    .map((vendeurId) => {
      const v = vendeurParId.get(vendeurId);
      return {
        vendeurId,
        nomBoutique: v?.nom_boutique ?? "Vendeur inconnu",
        infosReversement: v?.infos_reversement ?? null,
        montant: dettesParVendeur.get(vendeurId) ?? 0,
      };
    })
    .sort((a, b) => b.montant - a.montant);

  const soldeReel = totalEntreesTousTemps - totalDepensesTousTemps - totalReverseTousTemps;
  const dettesVendeursTotal = dettesVendeurs.reduce((s, d) => s + d.montant, 0);
  const soldeComptable = soldeReel + creancesEnCours - dettesVendeursTotal;

  return {
    periode,
    totalEntreesPeriode,
    totalDepensesPeriode: totalDepensesPeriodeManuelles + totalReversePeriode,
    soldeReel,
    soldeComptable,
    creancesEnCours,
    dettesVendeursTotal,
    dettesVendeurs,
  };
}

// Marque comme reversées toutes les lignes vendeur en attente (commandes déjà
// encaissées) pour ce vendeur : à appeler quand l'admin l'a effectivement payé.
export async function reverserVendeur(vendeurId: string): Promise<ActionResult> {
  await requireAdmin();

  const { data: produitsRows } = await supabaseAdmin.from("produits").select("id").eq("vendeur_id", vendeurId);
  const produitIds = (produitsRows ?? []).map((p) => p.id as number);
  if (produitIds.length === 0) return { ok: true };

  const { data: commandesRows } = await supabaseAdmin
    .from("commandes")
    .select("id, statut, statut_paiement, mode_paiement");
  const idsEncaissees = ((commandesRows ?? []) as Pick<Commande, "id" | "statut" | "statut_paiement" | "mode_paiement">[])
    .filter(estEncaissee)
    .map((c) => c.id);
  if (idsEncaissees.length === 0) return { ok: true };

  const { error } = await supabaseAdmin
    .from("commande_items")
    .update({ reverse_le: new Date().toISOString() })
    .in("produit_id", produitIds)
    .in("commande_id", idsEncaissees)
    .is("reverse_le", null);

  if (error) return { ok: false, error: "Impossible d'enregistrer le reversement." };
  return { ok: true };
}

export type DepenseInput = {
  categorie: CategorieDepense;
  montant: number;
  date: string;
  note: string | null;
};

function validerDepense(input: DepenseInput): string | null {
  if (!CATEGORIES_DEPENSE.some((c) => c.valeur === input.categorie)) return "Catégorie invalide.";
  if (!Number.isFinite(input.montant) || input.montant <= 0) return "Le montant doit être positif.";
  if (!input.date || Number.isNaN(new Date(input.date).getTime())) return "Date invalide.";
  if (input.note != null && input.note.length > 300) return "La note est trop longue (300 caractères maximum).";
  return null;
}

export async function listerDepenses(): Promise<Depense[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("depenses")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as Depense[];
}

export async function creerDepense(input: DepenseInput): Promise<ActionResult> {
  await requireAdmin();
  const erreur = validerDepense(input);
  if (erreur) return { ok: false, error: erreur };

  const { error } = await supabaseAdmin.from("depenses").insert({
    categorie: input.categorie,
    montant: Math.round(input.montant),
    date: input.date,
    note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: "Impossible d'enregistrer la dépense." };
  return { ok: true };
}

export async function supprimerDepense(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("depenses").delete().eq("id", id);
  if (error) return { ok: false, error: "Suppression impossible." };
  return { ok: true };
}
