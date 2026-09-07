import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { aplatirAttributs, libelleVariante } from "@/lib/variantes";
import { estVendeurSacAdo } from "@/lib/vendeurs/constants";
import { STATUTS_COMMANDE_A_PREPARER, refPreparation } from "@/lib/preparations";
import { envoyerPushVendeur } from "@/lib/push";

// Machinerie partagée : lire les articles « à préparer » d'un vendeur et créer
// une demande (instantané figé + message in-app). Utilisé par l'action admin
// manuelle ET par le déclenchement automatique des commandes 24h.
// Pas de contrôle d'accès ici : l'appelant vérifie (requireAdmin, ou webhook).

const STATUTS = [...STATUTS_COMMANDE_A_PREPARER];

type Rel<T> = T | T[] | null;
export function un<T>(v: Rel<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Libellé « Bleu · M » par variante_id.
export async function labelsVariantes(varianteIds: number[]): Promise<Map<number, string>> {
  const ids = [...new Set(varianteIds)];
  if (ids.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from("produit_variantes")
    .select("id, variante_attributs(attribut_id, valeur, attributs(nom))")
    .in("id", ids);
  const map = new Map<number, string>();
  type Ligne = {
    id: number;
    variante_attributs?:
      | { attribut_id: number; valeur: string; attributs: { nom: string } | { nom: string }[] | null }[]
      | null;
  };
  for (const row of (data ?? []) as Ligne[]) {
    const label = libelleVariante({ attributs: aplatirAttributs(row) });
    if (label) map.set(row.id, label);
  }
  return map;
}

async function itemsDejaDemandes(): Promise<Set<number>> {
  const { data } = await supabaseAdmin.from("demande_preparation_items").select("commande_item_id");
  return new Set((data ?? []).map((r) => r.commande_item_id as number));
}

export type LigneEnAttente = {
  id: number;
  commande_id: number;
  produit_id: number;
  variante_id: number | null;
  quantite: number;
  commande: Rel<{
    statut: string;
    mode_livraison: string | null;
    client: Rel<{ nom: string }>;
    zone: Rel<{ nom: string }>;
  }>;
};

// Articles d'un vendeur, dans une commande confirmée non encore livrée, pas déjà
// inclus dans une demande. `commandeIds` restreint à certaines commandes.
export async function lignesEnAttente(
  produitIds: number[],
  commandeIds?: number[],
): Promise<LigneEnAttente[]> {
  if (produitIds.length === 0) return [];
  let query = supabaseAdmin
    .from("commande_items")
    .select(
      `id, commande_id, produit_id, variante_id, quantite,
       commande:commandes!inner(statut, mode_livraison, client:clients(nom), zone:zones(nom))`,
    )
    .in("produit_id", produitIds)
    .in("commande.statut", STATUTS);
  if (commandeIds && commandeIds.length > 0) query = query.in("commande_id", commandeIds);
  const { data } = await query;
  const assignes = await itemsDejaDemandes();
  return ((data ?? []) as unknown as LigneEnAttente[]).filter((l) => !assignes.has(l.id));
}

export async function produitsDuVendeur(
  vendeurId: string,
): Promise<{ id: number; nom: string; photo: string | null }[]> {
  const { data } = await supabaseAdmin
    .from("produits")
    .select("id, nom, photo")
    .eq("vendeur_id", vendeurId);
  return (data ?? []) as { id: number; nom: string; photo: string | null }[];
}

export type CreationDemande =
  | { ok: true; id: number; nbArticles: number; nbClients: number }
  | { ok: false; error: string };

export async function creerDemandePourVendeur(
  vendeurId: string,
  declenchement: "manuel" | "auto_24h",
  opts: { note?: string | null; commandeIds?: number[] } = {},
): Promise<CreationDemande> {
  if (estVendeurSacAdo(vendeurId)) {
    return { ok: false, error: "Le vendeur SacAdo n'a pas de préparation externe." };
  }

  const produits = await produitsDuVendeur(vendeurId);
  if (produits.length === 0) return { ok: false, error: "Ce vendeur n'a aucun article à préparer." };
  const produitParId = new Map(produits.map((p) => [p.id, p]));

  const lignes = await lignesEnAttente(
    produits.map((p) => p.id),
    opts.commandeIds,
  );
  if (lignes.length === 0) return { ok: false, error: "Aucun article en attente pour ce vendeur." };

  const labels = await labelsVariantes(
    lignes.map((l) => l.variante_id).filter((v): v is number => v != null),
  );

  const { data: demande, error: errDemande } = await supabaseAdmin
    .from("demandes_preparation")
    .insert({ vendeur_id: vendeurId, declenchement, note: opts.note?.trim() || null })
    .select("id")
    .single();
  if (errDemande || !demande) return { ok: false, error: "Impossible de créer la demande." };

  const items = lignes.map((l) => {
    const commande = un(l.commande);
    const produit = produitParId.get(l.produit_id);
    return {
      demande_id: demande.id,
      commande_id: l.commande_id,
      commande_item_id: l.id,
      produit_id: l.produit_id,
      quantite: l.quantite,
      produit_nom: produit?.nom ?? "Article",
      variante_label: l.variante_id != null ? (labels.get(l.variante_id) ?? null) : null,
      produit_photo: produit?.photo ?? null,
      client_nom: un(commande?.client)?.nom ?? "Client",
      mode_livraison: commande?.mode_livraison ?? null,
      zone_nom: un(commande?.zone)?.nom ?? null,
    };
  });

  const { error: errItems } = await supabaseAdmin.from("demande_preparation_items").insert(items);
  if (errItems) {
    // Course : un article vient d'être pris par une autre demande. On annule la
    // demande vide plutôt que de laisser un enregistrement bancal.
    await supabaseAdmin.from("demandes_preparation").delete().eq("id", demande.id);
    return { ok: false, error: "Un article vient d'être inclus dans une autre demande. Recommence." };
  }

  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0);
  const nbClients = new Set(lignes.map((l) => l.commande_id)).size;

  const titre =
    declenchement === "auto_24h" ? "Préparation urgente (livraison 24h)" : "Préparation demandée";
  const corps = `${nbArticles} article${nbArticles > 1 ? "s" : ""} à préparer pour ${nbClients} client${
    nbClients > 1 ? "s" : ""
  }.`;

  // Notification in-app dans la boîte de réception du vendeur (canal de base,
  // NOTIFICATIONS_FOURNISSEURS §1).
  await supabaseAdmin.from("messages_vendeur").insert({
    vendeur_id: vendeurId,
    type: "preparation",
    titre,
    corps: `${corps} Ouvrez le bon de préparation pour le détail.`,
    demande_preparation_id: demande.id,
  });

  // Notification push (canal d'appoint) : sans effet si le vendeur n'a pas
  // d'abonnement ou si les clés VAPID ne sont pas configurées.
  await envoyerPushVendeur(vendeurId, {
    title: `${titre} — ${refPreparation(demande.id)}`,
    body: corps,
    url: `/vendeur/preparations/${demande.id}`,
  });

  return { ok: true, id: demande.id, nbArticles, nbClients };
}
