import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DemandePreparation } from "@/lib/supabase/types";
import type { DemandePreparationDetail, GroupeClient, LigneTotal } from "@/lib/preparations";

// Assemble le bon de préparation d'une demande (regroupé par client + total).
// SANS contrôle d'accès : l'appelant vérifie soit `requireAdmin`, soit le jeton
// du lien fournisseur.
export async function chargerBonPreparation(id: number): Promise<DemandePreparationDetail | null> {
  if (!Number.isFinite(id)) return null;

  const { data: demande } = await supabaseAdmin
    .from("demandes_preparation")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!demande) return null;
  const d = demande as DemandePreparation;

  const { data: vendeur } = await supabaseAdmin
    .from("vendeurs")
    .select("nom_boutique, contact_telephone")
    .eq("id", d.vendeur_id)
    .maybeSingle();

  const { data: itemsRows } = await supabaseAdmin
    .from("demande_preparation_items")
    .select("*")
    .eq("demande_id", id);
  const items = (itemsRows ?? []) as {
    commande_id: number;
    quantite: number;
    produit_nom: string;
    variante_label: string | null;
    produit_photo: string | null;
    client_nom: string;
    mode_livraison: string | null;
    zone_nom: string | null;
  }[];

  const groupesParCommande = new Map<number, GroupeClient>();
  const totaux = new Map<string, LigneTotal>();
  let nbArticles = 0;

  for (const it of items) {
    let groupe = groupesParCommande.get(it.commande_id);
    if (!groupe) {
      groupe = {
        commandeId: it.commande_id,
        clientNom: it.client_nom,
        modeLivraison: it.mode_livraison,
        zoneNom: it.zone_nom,
        articles: [],
      };
      groupesParCommande.set(it.commande_id, groupe);
    }
    groupe.articles.push({
      produitNom: it.produit_nom,
      varianteLabel: it.variante_label,
      produitPhoto: it.produit_photo,
      quantite: it.quantite,
    });

    const cle = `${it.produit_nom}|${it.variante_label ?? ""}`;
    const t = totaux.get(cle) ?? { produitNom: it.produit_nom, varianteLabel: it.variante_label, quantite: 0 };
    t.quantite += it.quantite;
    totaux.set(cle, t);
    nbArticles += it.quantite;
  }

  const v = vendeur as { nom_boutique: string; contact_telephone: string | null } | null;

  return {
    id: d.id,
    vendeurNom: v?.nom_boutique ?? "Vendeur",
    vendeurTelephone: v?.contact_telephone ?? null,
    statut: d.statut,
    declenchement: d.declenchement,
    note: d.note,
    creeLe: d.cree_le,
    prepareeLe: d.preparee_le,
    recupereeLe: d.recuperee_le,
    groupes: [...groupesParCommande.values()].sort((a, b) => a.clientNom.localeCompare(b.clientNom)),
    totaux: [...totaux.values()].sort((a, b) => a.produitNom.localeCompare(b.produitNom)),
    nbArticles,
  };
}
