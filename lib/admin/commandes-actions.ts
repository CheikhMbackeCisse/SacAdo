"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifierPushStatutCommande } from "@/lib/messages/notifier";
import { declencherPreparationsAuto } from "@/lib/preparation-auto";
import type { Commande, CommandeAjout, CommandeItem, StatutCommande } from "@/lib/supabase/types";
import type { ActionResult } from "./produits-actions";

export type CommandeAvecClient = Commande & {
  client_nom: string;
  client_telephone: string;
  facture_id: number | null;
  code_confirmation: string | null;
};

type ClientJoint = { nom: string; telephone: string } | { nom: string; telephone: string }[] | null;
type FactureJoint = { id: number; code_confirmation: string } | { id: number; code_confirmation: string }[] | null;

function mapCommandeRow(
  row: Commande & { client: ClientJoint; facture: FactureJoint },
): CommandeAvecClient {
  const client = Array.isArray(row.client) ? row.client[0] : row.client;
  const facture = Array.isArray(row.facture) ? row.facture[0] : row.facture;
  return {
    id: row.id,
    client_id: row.client_id,
    zone_id: row.zone_id,
    adresse: row.adresse,
    mode_livraison: row.mode_livraison,
    frais_livraison: row.frais_livraison,
    mode_paiement: row.mode_paiement,
    sous_total: row.sous_total,
    total: row.total,
    statut: row.statut,
    date: row.date,
    client_reference: row.client_reference,
    statut_paiement: row.statut_paiement,
    wave_session_id: row.wave_session_id,
    wave_event_id: row.wave_event_id,
    montant_paye: row.montant_paye,
    wave_erreur_code: row.wave_erreur_code,
    wave_erreur_le: row.wave_erreur_le,
    enfants_ebook: row.enfants_ebook,
    lat: row.lat,
    lng: row.lng,
    precision_livreur: row.precision_livreur,
    lien_localisation: row.lien_localisation,
    localite_id: row.localite_id,
    lieu_special_id: row.lieu_special_id,
    localite_nom: row.localite_nom,
    frais_livraison_a_confirmer: row.frais_livraison_a_confirmer,
    message_livraison: row.message_livraison,
    telephone_normalise: row.telephone_normalise,
    date_livraison_prevue: row.date_livraison_prevue,
    appel_tentatives: row.appel_tentatives,
    appel_dernier_essai_le: row.appel_dernier_essai_le,
    est_test: row.est_test,
    source_localisation: row.source_localisation,
    distance_localite_km: row.distance_localite_km,
    client_nom: client?.nom ?? "—",
    client_telephone: client?.telephone ?? "—",
    facture_id: facture?.id ?? null,
    code_confirmation: facture?.code_confirmation ?? null,
  };
}

const TAILLE_PAGE_COMMANDES = 50;

// Liste paginée : utilisée par /admin/commandes pour ne pas charger tout
// l'historique d'un coup quand le volume de commandes grossit.
export async function getCommandesAdmin(
  statut?: StatutCommande,
  {
    offset = 0,
    limit = TAILLE_PAGE_COMMANDES,
    dateLivraison,
    test = false,
  }: { offset?: number; limit?: number; dateLivraison?: string; test?: boolean } = {},
): Promise<{ items: CommandeAvecClient[]; hasMore: boolean }> {
  await requireAdmin();

  let query = supabaseAdmin
    .from("commandes")
    .select("*, client:clients(nom, telephone), facture:factures(id, code_confirmation)")
    .order("date", { ascending: false })
    .range(offset, offset + limit);
  if (statut) query = query.eq("statut", statut);
  // Filtre "préparer la tournée" (maj-accueil §7) : une date précise pour les
  // commandes à date donnée.
  if (dateLivraison) query = query.eq("date_livraison_prevue", dateLivraison);
  // Filtre "Commandes de test" (PROMPT_ADMIN_COMPTA_LOCALITES.md Lot 1) : vue
  // normale = commandes réelles uniquement ; vue dédiée = uniquement les tests.
  query = query.eq("est_test", test);

  const { data, error } = await query;
  if (error) return { items: [], hasMore: false };

  const rows = (data ?? []) as unknown as (Commande & { client: ClientJoint; facture: FactureJoint })[];
  const hasMore = rows.length > limit;
  return { items: (hasMore ? rows.slice(0, limit) : rows).map(mapCommandeRow), hasMore };
}

export async function getCommandeAdmin(id: number): Promise<CommandeAvecClient | null> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("commandes")
    .select("*, client:clients(nom, telephone), facture:factures(id, code_confirmation)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapCommandeRow(data as unknown as Commande & { client: ClientJoint; facture: FactureJoint });
}

export async function changerStatutCommande(id: number, statut: StatutCommande): Promise<ActionResult> {
  await requireAdmin();

  // Une commande Wave en attente de paiement n'avance pas à la main : c'est le
  // webhook Wave qui la fait passer 'recue' (ou 'echoue'). On refuse aussi de
  // remettre une commande dans cet état manuellement.
  if (statut === "paiement_en_attente") {
    return { ok: false, error: "Statut réservé au paiement Wave." };
  }
  const { data: actuelle } = await supabaseAdmin
    .from("commandes")
    .select("statut, mode_livraison")
    .eq("id", id)
    .maybeSingle<{ statut: StatutCommande; mode_livraison: Commande["mode_livraison"] }>();
  if (actuelle?.statut === "paiement_en_attente") {
    return { ok: false, error: "Cette commande attend la confirmation du paiement Wave." };
  }

  // Annulation (PROMPT_ADMIN_V2 Lot 2, migration 0108) : passe par une
  // fonction dédiée qui relâche le stock réservé à la création, kit-aware —
  // un simple update laisserait le stock bloqué indéfiniment.
  if (statut === "annulee") {
    const { data, error: erreurRpc } = await supabaseAdmin.rpc("annuler_commande_admin", {
      p_commande_id: id,
    });
    if (erreurRpc) return { ok: false, error: "Impossible d'annuler cette commande." };
    if (data === "trop_tard") {
      return { ok: false, error: "Cette commande est déjà en livraison ou livrée." };
    }
    if (data === "deja_annulee") return { ok: true };
  } else {
    // Le trigger DB insère automatiquement le message de suivi côté client
    // (boîte de réception). Le push suit une matrice de canaux différente
    // (TACHE_notifications_client.md §2) : géré à part, ci-dessous.
    const { error } = await supabaseAdmin.from("commandes").update({ statut }).eq("id", id);
    if (error) return { ok: false, error: "Impossible de changer le statut." };
  }

  if (statut === "livree") await figerGarantieCommande([id]);

  // L'appel de confirmation vient d'aboutir (PROMPT_CLIENT_V2 Lot 1) : la
  // commande entre dans le flux normal, exactement comme un paiement Wave
  // confirmé (voir app/api/wave/webhook/route.ts). Prévenir les fournisseurs
  // seulement maintenant, pas dès la création à 'a_confirmer_appel'.
  if (statut === "recue" && actuelle?.statut === "a_confirmer_appel" && actuelle.mode_livraison === "24h") {
    await declencherPreparationsAuto(id);
  }

  await notifierPushStatutCommande(id, statut);
  return { ok: true };
}

// Ordinateurs reconditionnés (migration 0070) : à la livraison, la date de
// fin de garantie est figée sur la ligne de commande (date du jour +
// produits.garantie_mois), comme le prix d'achat l'est déjà. Ne touche que
// les lignes dont le produit a une garantie renseignée, et jamais deux fois
// (garantie_fin encore nulle) — relancer un changement de statut ne l'écrase
// pas une deuxième fois avec une date différente.
async function figerGarantieCommande(commandeIds: number[]): Promise<void> {
  const { data } = await supabaseAdmin
    .from("commande_items")
    .select("id, produit:produits(garantie_mois)")
    .in("commande_id", commandeIds)
    .is("garantie_fin", null);

  type Row = { id: number; produit: { garantie_mois: number | null } | { garantie_mois: number | null }[] | null };
  const rows = (data ?? []) as unknown as Row[];

  const today = new Date();
  await Promise.all(
    rows.map((row) => {
      const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
      const mois = produit?.garantie_mois;
      if (!mois) return Promise.resolve();
      const fin = new Date(today);
      fin.setMonth(fin.getMonth() + mois);
      return supabaseAdmin
        .from("commande_items")
        .update({ garantie_fin: fin.toISOString().slice(0, 10) })
        .eq("id", row.id);
    }),
  );
}

// Nombre de commandes 'recue', tous filtres/pagination confondus — alimente le
// bouton raccourci de CORRECTIONS_V9 §1.
export async function compterCommandesRecues(): Promise<number> {
  await requireAdmin();
  const { count, error } = await supabaseAdmin
    .from("commandes")
    .select("id", { count: "exact", head: true })
    .eq("statut", "recue")
    .eq("est_test", false);
  return error ? 0 : (count ?? 0);
}

// Bascule manuelle du marqueur "test" (PROMPT_ADMIN_COMPTA_LOCALITES.md Lot 1
// §5) : pour qu'un futur test ne fausse plus la comptabilité ni les stats.
export async function basculerCommandeTest(id: number, estTest: boolean): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("commandes").update({ est_test: estTest }).eq("id", id);
  if (error) return { ok: false, error: "Impossible de changer le statut de test." };
  return { ok: true };
}

// Action groupée : passe une sélection de commandes au même statut en un
// aller. Le trigger DB (for each row) envoie le message habituel à chaque
// client concerné, exactement comme un changement individuel.
export async function changerStatutCommandesGroupe(
  ids: number[],
  statut: StatutCommande,
): Promise<ActionResult> {
  await requireAdmin();
  if (ids.length === 0) return { ok: false, error: "Aucune commande sélectionnée." };
  if (statut === "paiement_en_attente") {
    return { ok: false, error: "Statut réservé au paiement Wave." };
  }

  // Appels de confirmation qui aboutissent dans ce lot (PROMPT_CLIENT_V2 Lot 1) :
  // il faut connaître l'état AVANT la mise à jour pour savoir lesquelles
  // prévenir les fournisseurs ensuite (même règle que changerStatutCommande).
  const aPrevenir: number[] =
    statut === "recue"
      ? (
          await supabaseAdmin
            .from("commandes")
            .select("id")
            .in("id", ids)
            .eq("statut", "a_confirmer_appel")
            .eq("mode_livraison", "24h")
        ).data?.map((c) => (c as { id: number }).id) ?? []
      : [];

  // Annulation groupée (migration 0108) : une fonction par commande, pour
  // relâcher le stock de chacune — un update de masse ne le ferait pas.
  if (statut === "annulee") {
    const { data: candidates } = await supabaseAdmin
      .from("commandes")
      .select("id")
      .in("id", ids)
      .neq("statut", "paiement_en_attente");
    const idsCandidats = (candidates ?? []).map((c) => (c as { id: number }).id);
    const idsModifiees: number[] = [];
    for (const commandeId of idsCandidats) {
      const { data } = await supabaseAdmin.rpc("annuler_commande_admin", { p_commande_id: commandeId });
      if (data === "ok") idsModifiees.push(commandeId);
    }
    await Promise.all(idsModifiees.map((id) => notifierPushStatutCommande(id, statut)));
    return { ok: true };
  }

  // Une commande Wave en attente ne doit pas être basculée par une action
  // groupée (même règle que le changement individuel) : on l'exclut plutôt
  // que de faire échouer tout le lot.
  const { data: modifiees, error } = await supabaseAdmin
    .from("commandes")
    .update({ statut })
    .in("id", ids)
    .neq("statut", "paiement_en_attente")
    .select("id");
  if (error) return { ok: false, error: "Impossible de changer le statut des commandes sélectionnées." };

  const idsModifiees = (modifiees ?? []).map((c) => (c as { id: number }).id);
  if (statut === "livree" && idsModifiees.length > 0) await figerGarantieCommande(idsModifiees);
  await Promise.all(aPrevenir.map((id) => declencherPreparationsAuto(id)));

  await Promise.all(idsModifiees.map((id) => notifierPushStatutCommande(id, statut)));
  return { ok: true };
}

// Raccourci CORRECTIONS_V9 §1 : traite d'un coup toutes les commandes 'recue'
// (indépendamment de la page/filtre affiché), pas seulement celles visibles.
export async function passerRecuesEnPreparation(): Promise<ActionResult> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("commandes")
    .update({ statut: "preparation" })
    .eq("statut", "recue");
  if (error) return { ok: false, error: "Impossible de passer les commandes reçues en préparation." };
  return { ok: true };
}

export type CommandeItemAvecProduit = CommandeItem & {
  produit_nom: string;
  // Kit électronique (migration 0073) : composition affichée dépliée sur la
  // fiche commande, pour savoir quoi mettre dans le carton — affichage
  // seulement, sans case à cocher (composition fixe, TACHE_kits_impression_classement.md §A.5).
  composants?: { nom: string; quantite: number }[];
  // Photo catalogue insuffisante (migration 0082, TACHE_remplacement_14_photos.md
  // §5) : rappel à l'emballage, seule source de vraies photos pour ces produits.
  photo_a_ameliorer: boolean;
};

export async function getCommandeItemsAdmin(commandeId: number): Promise<CommandeItemAvecProduit[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("commande_items")
    .select("*, produit:produits(nom, est_kit, photo_a_ameliorer)")
    .eq("commande_id", commandeId);
  if (error) return [];

  type Row = CommandeItem & {
    produit: { nom: string; est_kit: boolean; photo_a_ameliorer: boolean } | { nom: string; est_kit: boolean; photo_a_ameliorer: boolean }[] | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  const idsKits = rows
    .map((row) => (Array.isArray(row.produit) ? row.produit[0] : row.produit))
    .map((produit, i) => (produit?.est_kit ? rows[i].produit_id : null))
    .filter((id): id is number => id !== null);

  const compositionsParKit = new Map<number, { nom: string; quantite: number }[]>();
  if (idsKits.length > 0) {
    // FK explicite : composition_kit référence produits deux fois (kit_id et
    // composant_id), PostgREST refuse de deviner laquelle utiliser sinon.
    const { data: compo } = await supabaseAdmin
      .from("composition_kit")
      .select("kit_id, quantite, composant:produits!composition_kit_composant_id_fkey(nom)")
      .in("kit_id", idsKits);
    type CompoRow = { kit_id: number; quantite: number; composant: { nom: string } | { nom: string }[] | null };
    for (const c of (compo ?? []) as unknown as CompoRow[]) {
      const composant = Array.isArray(c.composant) ? c.composant[0] : c.composant;
      const liste = compositionsParKit.get(c.kit_id) ?? [];
      liste.push({ nom: composant?.nom ?? "Composant supprimé", quantite: c.quantite });
      compositionsParKit.set(c.kit_id, liste);
    }
  }

  return rows.map((row) => {
    const produit = Array.isArray(row.produit) ? row.produit[0] : row.produit;
    return {
      id: row.id,
      commande_id: row.commande_id,
      produit_id: row.produit_id,
      variante_id: row.variante_id,
      quantite: row.quantite,
      prix_unitaire: row.prix_unitaire,
      prix_achat_unitaire: row.prix_achat_unitaire,
      reverse_le: row.reverse_le,
      garantie_fin: row.garantie_fin,
      ajout_id: row.ajout_id,
      produit_nom: produit?.nom ?? "Produit supprimé",
      composants: produit?.est_kit ? compositionsParKit.get(row.produit_id) : undefined,
      photo_a_ameliorer: produit?.photo_a_ameliorer ?? false,
      kit_groupe_id: row.kit_groupe_id,
      kit_id: row.kit_id,
      kit_nom: row.kit_nom,
      kit_classe: row.kit_classe,
      kit_gamme: row.kit_gamme,
      kit_beneficiaire_prenom: row.kit_beneficiaire_prenom,
      personnalisation_nom: row.personnalisation_nom,
      personnalisation_specialite: row.personnalisation_specialite,
    };
  });
}

// Lots d'ajout d'une commande (PROMPT_ADMIN_V2 Lot 2, migration 0107) : la
// fiche commande les affiche à part ("Ajout du …"), chacun avec son propre
// paiement — jamais noyés dans les lignes d'origine.
export async function getCommandeAjoutsAdmin(commandeId: number): Promise<CommandeAjout[]> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("commande_ajouts")
    .select("*")
    .eq("commande_id", commandeId)
    .order("cree_le", { ascending: true });
  return (data ?? []) as CommandeAjout[];
}

// Confirmation par appel (PROMPT_ADMIN_V2 Lot 2) : "Injoignable" ne change pas
// le statut — la commande reste 'a_confirmer_appel' —, elle compte seulement
// la tentative pour que le fondateur voie qu'il a déjà essayé.
export async function marquerAppelInjoignable(id: number): Promise<ActionResult> {
  await requireAdmin();
  const { data: actuelle } = await supabaseAdmin
    .from("commandes")
    .select("statut, appel_tentatives")
    .eq("id", id)
    .maybeSingle<{ statut: StatutCommande; appel_tentatives: number }>();
  if (actuelle?.statut !== "a_confirmer_appel") {
    return { ok: false, error: "Cette commande n'attend plus de confirmation par appel." };
  }
  const { error } = await supabaseAdmin
    .from("commandes")
    .update({
      appel_tentatives: (actuelle.appel_tentatives ?? 0) + 1,
      appel_dernier_essai_le: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Impossible d'enregistrer la tentative d'appel." };
  return { ok: true };
}

// Modèle WhatsApp "appel de confirmation" (migration 0105), pré-chargé une
// fois pour toute la liste des commandes plutôt qu'une requête par carte —
// chaque carte ne fait plus que substituer ses propres variables.
export async function getModeleAppelWhatsApp(): Promise<string | null> {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("modeles_messages")
    .select("contenu")
    .eq("code", "commande_a_confirmer")
    .eq("canal", "whatsapp")
    .eq("actif", true)
    .maybeSingle();
  return (data?.contenu as string | undefined) ?? null;
}
