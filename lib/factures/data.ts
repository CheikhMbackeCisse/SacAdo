import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { labelsVariantes } from "@/lib/preparation-creer";
import type { Commande } from "@/lib/supabase/types";

export type LigneFacture = {
  produitNom: string;
  varianteLabel: string | null;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
};

export type DonneesFacture = {
  factureId: number;
  codeConfirmation: string;
  dateEmission: string;
  commande: Commande;
  clientNom: string;
  clientTelephone: string;
  lignes: LigneFacture[];
};

// Lecture complète pour générer le PDF (lib/factures/document.tsx) : commande,
// facture (numéro + code de confirmation, migration 0091), client, articles.
// Renvoie null si la commande n'existe pas OU si elle n'a pas encore de
// facture (ex. commande Wave toujours 'paiement_en_attente') — dans ce cas il
// n'y a simplement rien à générer.
export async function chargerDonneesFacture(commandeId: number): Promise<DonneesFacture | null> {
  const { data: commande } = await supabaseAdmin
    .from("commandes")
    .select("*")
    .eq("id", commandeId)
    .maybeSingle<Commande>();
  if (!commande) return null;

  const { data: facture } = await supabaseAdmin
    .from("factures")
    .select("id, code_confirmation, date_emission")
    .eq("commande_id", commandeId)
    .maybeSingle();
  if (!facture) return null;

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("nom, telephone")
    .eq("id", commande.client_id)
    .maybeSingle<{ nom: string; telephone: string }>();

  const { data: items } = await supabaseAdmin
    .from("commande_items")
    .select("variante_id, quantite, prix_unitaire, produit:produits(nom)")
    .eq("commande_id", commandeId);

  const varianteIds = (items ?? [])
    .map((i) => i.variante_id)
    .filter((v): v is number => v != null);
  const labels = await labelsVariantes(varianteIds);

  const lignes: LigneFacture[] = (items ?? []).map((i) => {
    const produit = Array.isArray(i.produit) ? i.produit[0] : i.produit;
    return {
      produitNom: produit?.nom ?? "Article",
      varianteLabel: i.variante_id != null ? (labels.get(i.variante_id) ?? null) : null,
      quantite: i.quantite,
      prixUnitaire: i.prix_unitaire,
      sousTotal: i.quantite * i.prix_unitaire,
    };
  });

  return {
    factureId: facture.id,
    codeConfirmation: facture.code_confirmation,
    dateEmission: facture.date_emission,
    commande,
    clientNom: client?.nom ?? "Client",
    clientTelephone: client?.telephone ?? "",
    lignes,
  };
}
