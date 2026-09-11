import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { envoyerPushClient, type PushPayload } from "@/lib/push";
import { rendreModele, codeModeleStatut, type VariablesModele } from "@/lib/messages/modeles";
import { heureCalmeDakar } from "@/lib/messages/heures-calmes";
import { suiviCommandesActif } from "@/lib/messages/preferences";
import { journaliserNotification } from "@/lib/messages/journal";
import { jetonClient } from "@/lib/client-auth";
import { origineSite } from "@/lib/site-url";
import type { StatutCommande } from "@/lib/supabase/types";

// Envoi push au changement de statut de commande (TACHE_notifications_client.md
// §2, §6, §7). La boîte de réception est déjà couverte par le trigger DB
// (migration 0058) ; ceci ne gère QUE le canal push, qui a besoin de Node
// (web-push) donc ne peut pas vivre dans un trigger SQL.

const PUSH_MAX_PAR_COMMANDE = 3;

type CommandePourPush = {
  id: number;
  client_id: number;
  total: number;
  localite_nom: string | null;
};

// Best-effort : ne jette jamais (un souci de push ne doit jamais faire
// échouer l'action métier qui a changé le statut).
export async function notifierPushStatutCommande(
  commandeId: number,
  statut: StatutCommande,
): Promise<void> {
  try {
    const code = codeModeleStatut(statut);
    if (!code) return; // statut sans push dans la matrice (préparation, souci…)

    const { data: modele } = await supabaseAdmin
      .from("modeles_messages")
      .select("titre, contenu")
      .eq("code", code)
      .eq("canal", "push")
      .eq("actif", true)
      .maybeSingle();
    if (!modele?.contenu) return; // pas de modèle push pour ce statut, ou désactivé

    const { data: commande } = await supabaseAdmin
      .from("commandes")
      .select("id, client_id, total, localite_nom")
      .eq("id", commandeId)
      .maybeSingle<CommandePourPush>();
    if (!commande) return;

    // Préférence client (§8) : le suivi de commande se coupe indépendamment
    // du reste. Vérifié avant de consommer le plafond — un push qu'on
    // n'envoie pas ne doit pas compter dedans.
    if (!(await suiviCommandesActif(commande.client_id))) {
      await journaliserNotification({
        clientId: commande.client_id,
        commandeId: commande.id,
        canal: "push",
        type: code,
        statut: "bloque_preference",
      });
      return;
    }

    // Réservation atomique du plafond AVANT tout envoi (immédiat ou différé) :
    // un push compté est un push qui partira, à un moment ou un autre.
    const { data: reserve } = await supabaseAdmin.rpc("reserver_push_commande", {
      p_commande_id: commandeId,
      p_max: PUSH_MAX_PAR_COMMANDE,
    });
    if (!reserve) return; // plafond déjà atteint pour cette commande

    const variables: VariablesModele = {
      numero_commande: commande.id,
      montant: Math.round(commande.total).toLocaleString("fr-FR"),
      localite: commande.localite_nom ?? "ta localité",
    };
    const titre = modele.titre ?? "SacAdo";
    const corps = rendreModele(modele.contenu, variables);
    const url = `${await origineSite()}/suivi/${commande.id}?t=${jetonClient(commande.client_id)}`;

    if (heureCalmeDakar()) {
      await supabaseAdmin.from("push_differes").insert({
        client_id: commande.client_id,
        commande_id: commande.id,
        code_modele: code,
        titre,
        corps,
        url,
      });
      await journaliserNotification({
        clientId: commande.client_id,
        commandeId: commande.id,
        canal: "push",
        type: code,
        statut: "differe",
      });
      return;
    }

    const payload: PushPayload = { title: titre, body: corps, url };
    const resultat = await envoyerPushClient(commande.client_id, payload);
    if (resultat.abonnements > 0) {
      await journaliserNotification({
        clientId: commande.client_id,
        commandeId: commande.id,
        canal: "push",
        type: code,
        statut: resultat.echecs >= resultat.abonnements ? "echec" : "envoye",
        detail: resultat.echecs > 0 ? `${resultat.echecs}/${resultat.abonnements} abonnements en échec` : null,
      });
    }
  } catch (e) {
    console.error("notifierPushStatutCommande a échoué", e);
  }
}
