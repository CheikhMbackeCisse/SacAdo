"use server";

import { requireVendeur } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tauxCommission } from "@/lib/commissions";
import { balleCote, etatNegociation, limiteAtteinte, prixEnJeu } from "@/lib/negociation";
import { getToursMax } from "@/lib/parametres";
import type { Commission, NegociationProposition, Produit } from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type MaNegociation = {
  produit: Produit;
  categorieNom: string;
  fil: NegociationProposition[];
  prixEnJeu: number;
  tauxCommission: number;
  // Balle côté vendeur : il peut accepter / contre-proposer / abandonner.
  aMoiDeJouer: boolean;
  limiteAtteinte: boolean;
};

// Fils de négociation du vendeur : ses produits encore en attente / en cours.
export async function getMesNegociations(): Promise<MaNegociation[]> {
  const { userId } = await requireVendeur();

  const [{ data: produitsData }, { data: categoriesData }, { data: commissionsData }, toursMax] =
    await Promise.all([
      supabaseAdmin
        .from("produits")
        .select("*")
        .eq("vendeur_id", userId)
        .in("statut_publication", ["en_attente", "negociation"])
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("categories").select("id, nom"),
      supabaseAdmin.from("commissions").select("*"),
      getToursMax(),
    ]);

  const produits = (produitsData ?? []) as Produit[];
  const categorieNom = new Map((categoriesData ?? []).map((c) => [c.id as number, c.nom as string]));
  const commissions = (commissionsData ?? []) as Commission[];

  const ids = produits.map((p) => p.id);
  const fils = new Map<number, NegociationProposition[]>();
  if (ids.length > 0) {
    const { data } = await supabaseAdmin
      .from("negociation_propositions")
      .select("*")
      .in("produit_id", ids)
      .order("date", { ascending: true });
    for (const prop of (data ?? []) as NegociationProposition[]) {
      const liste = fils.get(prop.produit_id) ?? [];
      liste.push(prop);
      fils.set(prop.produit_id, liste);
    }
  }

  return produits.map((produit) => {
    const fil = fils.get(produit.id) ?? [];
    const { tours } = etatNegociation(fil);
    return {
      produit,
      categorieNom: categorieNom.get(produit.categorie_id) ?? "—",
      fil,
      prixEnJeu: prixEnJeu(produit.prix, fil),
      tauxCommission: tauxCommission(commissions, produit.categorie_id, produit.sous_categorie_id),
      aMoiDeJouer: balleCote(produit.statut_publication, fil) === "vendeur",
      limiteAtteinte: limiteAtteinte(tours, toursMax),
    };
  });
}

async function chargerMonProduit(
  produitId: number,
  userId: string,
): Promise<{ produit: Produit; fil: NegociationProposition[] } | null> {
  const { data } = await supabaseAdmin
    .from("produits")
    .select("*")
    .eq("id", produitId)
    .eq("vendeur_id", userId)
    .maybeSingle();
  const produit = data as Produit | null;
  if (!produit) return null;

  const { data: fil } = await supabaseAdmin
    .from("negociation_propositions")
    .select("*")
    .eq("produit_id", produitId)
    .order("date", { ascending: true });

  return { produit, fil: (fil ?? []) as NegociationProposition[] };
}

async function fermerPropositionsOuvertes(produitId: number): Promise<void> {
  await supabaseAdmin
    .from("negociation_propositions")
    .update({ statut: "refuse" })
    .eq("produit_id", produitId)
    .eq("statut", "en_cours");
}

// Accepter le prix proposé par SacAdo → le produit est publié à ce prix.
export async function accepterPrixSacado(produitId: number): Promise<ActionResult> {
  const { userId } = await requireVendeur();
  const charge = await chargerMonProduit(produitId, userId);
  if (!charge) return { ok: false, error: "Produit introuvable." };
  const { produit, fil } = charge;

  if (balleCote(produit.statut_publication, fil) !== "vendeur") {
    return { ok: false, error: "Ce produit n'attend pas de réponse de votre part." };
  }

  const prix = prixEnJeu(produit.prix, fil);
  const ouverte = fil.find((p) => p.statut === "en_cours");
  if (ouverte) {
    await supabaseAdmin
      .from("negociation_propositions")
      .update({ statut: "accepte" })
      .eq("id", ouverte.id);
  }

  const { error } = await supabaseAdmin
    .from("produits")
    .update({ statut_publication: "publie", prix, motif_refus: null })
    .eq("id", produitId)
    .eq("vendeur_id", userId);
  if (error) return { ok: false, error: "Impossible de publier le produit." };
  return { ok: true };
}

// Re-proposer un autre prix → la balle repasse à SacAdo.
export async function contreProposerVendeur(produitId: number, prix: number): Promise<ActionResult> {
  const { userId } = await requireVendeur();
  if (!Number.isFinite(prix) || prix <= 0) {
    return { ok: false, error: "Le prix proposé doit être un nombre positif." };
  }
  const prixArrondi = Math.round(prix);

  const charge = await chargerMonProduit(produitId, userId);
  if (!charge) return { ok: false, error: "Produit introuvable." };
  const { produit, fil } = charge;

  if (balleCote(produit.statut_publication, fil) !== "vendeur") {
    return { ok: false, error: "Ce produit n'attend pas de réponse de votre part." };
  }

  const { tours } = etatNegociation(fil);
  if (limiteAtteinte(tours, await getToursMax())) {
    return {
      ok: false,
      error: "Limite d'allers-retours atteinte : accepter le prix de SacAdo ou abandonner.",
    };
  }

  await fermerPropositionsOuvertes(produitId);
  const { error: propError } = await supabaseAdmin.from("negociation_propositions").insert({
    produit_id: produitId,
    auteur: "vendeur",
    prix_propose: prixArrondi,
    statut: "en_cours",
  });
  if (propError) return { ok: false, error: "Impossible d'enregistrer la proposition." };

  const { error } = await supabaseAdmin
    .from("produits")
    .update({ statut_publication: "negociation", prix: prixArrondi })
    .eq("id", produitId)
    .eq("vendeur_id", userId);
  if (error) return { ok: false, error: "Impossible de mettre à jour le produit." };
  return { ok: true };
}

// Abandonner la négociation → le produit n'est pas publié.
export async function abandonnerNegociation(produitId: number, motif: string): Promise<ActionResult> {
  const { userId } = await requireVendeur();
  const charge = await chargerMonProduit(produitId, userId);
  if (!charge) return { ok: false, error: "Produit introuvable." };
  const { produit } = charge;

  if (produit.statut_publication !== "en_attente" && produit.statut_publication !== "negociation") {
    return { ok: false, error: "Ce produit n'est pas en cours de négociation." };
  }

  const motifNet = motif.trim();
  const motifFinal = motifNet
    ? `Abandonné par le vendeur : ${motifNet}`
    : "Abandonné par le vendeur.";

  await fermerPropositionsOuvertes(produitId);
  const { error } = await supabaseAdmin
    .from("produits")
    .update({ statut_publication: "refuse", motif_refus: motifFinal })
    .eq("id", produitId)
    .eq("vendeur_id", userId);
  if (error) return { ok: false, error: "Impossible d'abandonner la négociation." };
  return { ok: true };
}
