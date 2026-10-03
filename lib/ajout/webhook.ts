import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { declencherPreparationsAuto } from "@/lib/preparation-auto";
import { rendreModele } from "@/lib/messages/modeles";
import type { EvenementWave } from "@/lib/wave/webhook-core";

// Boîte de réception pour un ajout confirmé — dupliquée (volontairement) de
// lib/ajout/actions.ts::notifierAjoutConfirme : ce fichier est appelé depuis
// la route webhook (jamais "use server"), l'autre depuis des server actions ;
// les deux ne peuvent pas partager un module "use server".
async function notifierAjoutConfirme(commandeId: number, sousTotal: number): Promise<void> {
  try {
    const { data: modele } = await supabaseAdmin
      .from("modeles_messages")
      .select("titre, contenu")
      .eq("code", "commande_ajout")
      .eq("canal", "inbox")
      .eq("actif", true)
      .maybeSingle();
    if (!modele?.contenu) return;

    const { data: commande } = await supabaseAdmin
      .from("commandes")
      .select("client_id")
      .eq("id", commandeId)
      .maybeSingle();
    if (!commande) return;

    const montant = Math.round(sousTotal).toLocaleString("fr-FR");
    await supabaseAdmin.from("messages").insert({
      client_id: commande.client_id,
      type: "commande",
      titre: modele.titre ?? "Ajout à ta commande",
      corps: rendreModele(modele.contenu, { numero_commande: commandeId, montant }),
      lien: `/suivi/${commandeId}`,
    });
  } catch (e) {
    console.error("notifierAjoutConfirme (webhook) a échoué", e);
  }
}

// Appelé par la route webhook (app/api/wave/webhook/route.ts) quand
// traiter_paiement_wave() ne trouve pas de commande pour la référence reçue :
// il peut s'agir du paiement d'un AJOUT (PROMPT_CLIENT_V2 Lot 4, migration
// 0107) plutôt que d'une commande. Retourne le code résultat de
// traiter_paiement_ajout_wave (jamais 'commande_introuvable' deux fois : si
// l'ajout non plus n'existe pas, 'ajout_introuvable' est journalisé tel quel).
export async function traiterCommeAjoutWave(evenement: EvenementWave): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("traiter_paiement_ajout_wave", {
    p_event_id: evenement.id,
    p_reference: evenement.reference,
    p_session_id: evenement.sessionId,
    p_resultat: evenement.resultat,
    p_montant: evenement.montant,
  });
  if (error) {
    console.error("Webhook Wave: traiter_paiement_ajout_wave a échoué", error);
    return "erreur_interne";
  }

  if (data === "ok_payee") {
    const { data: ajout } = await supabaseAdmin
      .from("commande_ajouts")
      .select("commande_id, sous_total")
      .eq("reference", evenement.reference)
      .maybeSingle();
    if (ajout) {
      await declencherPreparationsAuto(ajout.commande_id);
      await notifierAjoutConfirme(ajout.commande_id, ajout.sous_total);
    }
  }

  return data as string;
}
