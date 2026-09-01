"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";
import { tauxCommission } from "@/lib/commissions";
import { balleCote, etatNegociation, limiteAtteinte, prixEnJeu } from "@/lib/negociation";
import type {
  Commission,
  NegociationProposition,
  Produit,
  TypeMessageVendeur,
} from "@/lib/supabase/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Un produit en attente d'une décision de l'admin, avec tout le contexte utile
// pour trancher (fil, prix en jeu, taux de commission, boutique).
export type ProduitAModererer = {
  produit: Produit;
  vendeurNom: string;
  categorieNom: string;
  fil: NegociationProposition[];
  prixEnJeu: number;
  tauxCommission: number;
  tours: number;
  limiteAtteinte: boolean;
};

async function chargerFils(produitIds: number[]): Promise<Map<number, NegociationProposition[]>> {
  const map = new Map<number, NegociationProposition[]>();
  if (produitIds.length === 0) return map;
  const { data } = await supabaseAdmin
    .from("negociation_propositions")
    .select("*")
    .in("produit_id", produitIds)
    .order("date", { ascending: true });
  for (const prop of (data ?? []) as NegociationProposition[]) {
    const liste = map.get(prop.produit_id) ?? [];
    liste.push(prop);
    map.set(prop.produit_id, liste);
  }
  return map;
}

// File de modération : produits vendeur dont la balle est côté admin.
export async function getFileNegociation(): Promise<ProduitAModererer[]> {
  await requireAdmin();

  const [{ data: produitsData }, { data: vendeursData }, { data: categoriesData }, { data: commissionsData }] =
    await Promise.all([
      supabaseAdmin
        .from("produits")
        .select("*")
        .not("vendeur_id", "is", null)
        .in("statut_publication", ["en_attente", "negociation"])
        .order("created_at", { ascending: true }),
      supabaseAdmin.from("vendeurs").select("id, nom_boutique"),
      supabaseAdmin.from("categories").select("id, nom"),
      supabaseAdmin.from("commissions").select("*"),
    ]);

  const produits = (produitsData ?? []) as Produit[];
  const fils = await chargerFils(produits.map((p) => p.id));
  const vendeurNom = new Map((vendeursData ?? []).map((v) => [v.id as string, v.nom_boutique as string]));
  const categorieNom = new Map((categoriesData ?? []).map((c) => [c.id as number, c.nom as string]));
  const commissions = (commissionsData ?? []) as Commission[];

  return produits
    .map((produit) => {
      const fil = fils.get(produit.id) ?? [];
      const { tours } = etatNegociation(fil);
      return {
        produit,
        vendeurNom: produit.vendeur_id ? (vendeurNom.get(produit.vendeur_id) ?? "—") : "—",
        categorieNom: categorieNom.get(produit.categorie_id) ?? "—",
        fil,
        prixEnJeu: prixEnJeu(produit.prix, fil),
        tauxCommission: tauxCommission(commissions, produit.categorie_id, produit.sous_categorie_id),
        tours,
        limiteAtteinte: limiteAtteinte(tours),
      };
    })
    .filter((item) => balleCote(item.produit.statut_publication, item.fil) === "admin");
}

async function chargerProduitVendeur(
  produitId: number,
): Promise<{ produit: Produit; vendeurId: string; fil: NegociationProposition[] } | null> {
  const { data } = await supabaseAdmin
    .from("produits")
    .select("*")
    .eq("id", produitId)
    .maybeSingle();
  const produit = data as Produit | null;
  if (!produit || !produit.vendeur_id) return null;

  const { data: fil } = await supabaseAdmin
    .from("negociation_propositions")
    .select("*")
    .eq("produit_id", produitId)
    .order("date", { ascending: true });

  return { produit, vendeurId: produit.vendeur_id, fil: (fil ?? []) as NegociationProposition[] };
}

async function notifierVendeur(
  vendeurId: string,
  type: TypeMessageVendeur,
  titre: string,
  corps: string,
  produitId: number,
): Promise<void> {
  await supabaseAdmin
    .from("messages_vendeur")
    .insert({ vendeur_id: vendeurId, type, titre, corps, produit_id: produitId });
}

async function fermerPropositionsOuvertes(produitId: number): Promise<void> {
  await supabaseAdmin
    .from("negociation_propositions")
    .update({ statut: "refuse" })
    .eq("produit_id", produitId)
    .eq("statut", "en_cours");
}

// Accepter le prix en jeu → le produit est publié à ce prix.
export async function accepterPrix(produitId: number): Promise<ActionResult> {
  await requireAdmin();
  const charge = await chargerProduitVendeur(produitId);
  if (!charge) return { ok: false, error: "Produit introuvable." };
  const { produit, vendeurId, fil } = charge;

  if (balleCote(produit.statut_publication, fil) !== "admin") {
    return { ok: false, error: "Ce produit n'attend pas de décision de votre part." };
  }

  const prix = prixEnJeu(produit.prix, fil);
  const ouverte = fil.find((p) => p.statut === "en_cours");

  if (ouverte) {
    await supabaseAdmin
      .from("negociation_propositions")
      .update({ statut: "accepte" })
      .eq("id", ouverte.id);
  } else {
    await supabaseAdmin.from("negociation_propositions").insert({
      produit_id: produitId,
      auteur: "vendeur",
      prix_propose: prix,
      statut: "accepte",
    });
  }

  const { error } = await supabaseAdmin
    .from("produits")
    .update({ statut_publication: "publie", prix, motif_refus: null })
    .eq("id", produitId);
  if (error) return { ok: false, error: "Impossible de publier le produit." };

  await notifierVendeur(
    vendeurId,
    "publication",
    "Produit publié",
    `Votre produit « ${produit.nom} » a été publié à ${formatPrice(prix)}.`,
    produitId,
  );
  return { ok: true };
}

// Contre-proposer un autre prix → la balle repasse au vendeur.
export async function contreProposer(produitId: number, prix: number): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isFinite(prix) || prix <= 0) {
    return { ok: false, error: "Le prix proposé doit être un nombre positif." };
  }
  const prixArrondi = Math.round(prix);

  const charge = await chargerProduitVendeur(produitId);
  if (!charge) return { ok: false, error: "Produit introuvable." };
  const { produit, vendeurId, fil } = charge;

  if (balleCote(produit.statut_publication, fil) !== "admin") {
    return { ok: false, error: "Ce produit n'attend pas de décision de votre part." };
  }

  const { tours } = etatNegociation(fil);
  if (limiteAtteinte(tours)) {
    return {
      ok: false,
      error: "Limite d'allers-retours atteinte : accepter le dernier prix ou refuser le produit.",
    };
  }

  await fermerPropositionsOuvertes(produitId);
  const { error: propError } = await supabaseAdmin.from("negociation_propositions").insert({
    produit_id: produitId,
    auteur: "admin",
    prix_propose: prixArrondi,
    statut: "en_cours",
  });
  if (propError) return { ok: false, error: "Impossible d'enregistrer la proposition." };

  const { error } = await supabaseAdmin
    .from("produits")
    .update({ statut_publication: "negociation", prix: prixArrondi })
    .eq("id", produitId);
  if (error) return { ok: false, error: "Impossible de mettre à jour le produit." };

  await notifierVendeur(
    vendeurId,
    "negociation",
    "Nouvelle proposition de prix",
    `SacAdo propose un nouveau prix pour « ${produit.nom} » : ${formatPrice(prixArrondi)}.`,
    produitId,
  );
  return { ok: true };
}

// Refuser le produit (abandon de la négociation), motif facultatif.
export async function refuserProduit(produitId: number, motif: string): Promise<ActionResult> {
  await requireAdmin();
  const charge = await chargerProduitVendeur(produitId);
  if (!charge) return { ok: false, error: "Produit introuvable." };
  const { produit, vendeurId } = charge;

  if (produit.statut_publication !== "en_attente" && produit.statut_publication !== "negociation") {
    return { ok: false, error: "Ce produit n'est pas en cours de validation." };
  }

  const motifNet = motif.trim() || null;
  await fermerPropositionsOuvertes(produitId);

  const { error } = await supabaseAdmin
    .from("produits")
    .update({ statut_publication: "refuse", motif_refus: motifNet })
    .eq("id", produitId);
  if (error) return { ok: false, error: "Impossible de refuser le produit." };

  await notifierVendeur(
    vendeurId,
    "refus",
    "Produit non retenu",
    `Votre produit « ${produit.nom} » n'a pas été retenu.` + (motifNet ? ` Motif : ${motifNet}` : ""),
    produitId,
  );
  return { ok: true };
}
