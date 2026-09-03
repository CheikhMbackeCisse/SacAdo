"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ModeLivraison, StatutCommande } from "@/lib/supabase/types";

export type LivraisonCommande = {
  id: number;
  clientNom: string;
  clientTelephone: string;
  total: number;
  modeLivraison: ModeLivraison;
  precisionLivreur: string | null;
  zoneNom: string;
  statut: StatutCommande;
  lat: number;
  lng: number;
  articles: { nom: string; quantite: number }[];
};

type Rel<T> = T | T[] | null;
function un<T>(v: Rel<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Commandes à livrer : PAS encore « livrée », PAS en attente de paiement Wave
// (donc payée d'avance OU à régler à la livraison), et avec une position GPS.
// Quand l'admin passe une commande à « livrée », elle sort de cette liste →
// son pin disparaît de la carte (ADMIN_RESPONSIVE_ET_CARTE_LIVRAISON §2).
export async function getLivraisons(): Promise<LivraisonCommande[]> {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("commandes")
    .select(
      `id, total, mode_livraison, precision_livreur, statut, lat, lng,
       client:clients(nom, telephone),
       zone:zones(nom),
       commande_items(quantite, produit:produits(nom))`,
    )
    .not("statut", "in", "(livree,paiement_en_attente)")
    .not("lat", "is", null)
    .not("lng", "is", null)
    .order("date", { ascending: true });

  if (error || !data) return [];

  type Row = {
    id: number;
    total: number;
    mode_livraison: ModeLivraison;
    precision_livreur: string | null;
    statut: StatutCommande;
    lat: number;
    lng: number;
    client: Rel<{ nom: string; telephone: string }>;
    zone: Rel<{ nom: string }>;
    commande_items: { quantite: number; produit: Rel<{ nom: string }> }[] | null;
  };

  return (data as unknown as Row[]).map((r) => {
    const client = un(r.client);
    return {
      id: r.id,
      clientNom: client?.nom ?? "—",
      clientTelephone: client?.telephone ?? "—",
      total: r.total,
      modeLivraison: r.mode_livraison,
      precisionLivreur: r.precision_livreur,
      zoneNom: un(r.zone)?.nom ?? "—",
      statut: r.statut,
      lat: r.lat,
      lng: r.lng,
      articles: (r.commande_items ?? []).map((it) => ({
        nom: un(it.produit)?.nom ?? "Article",
        quantite: it.quantite,
      })),
    };
  });
}
