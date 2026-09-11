import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { envoyerPushClient, type PushPayload } from "@/lib/push";
import { rendreModele, type VariablesModele } from "@/lib/messages/modeles";
import { heureCalmeDakar } from "@/lib/messages/heures-calmes";
import { getPreferences } from "@/lib/messages/preferences";
import { journaliserNotification } from "@/lib/messages/journal";

// Événements catalogue (TACHE_notifications_client.md §2, lot B6) : produit
// demandé trouvé, favori de retour en stock, baisse de prix, rappel de
// rentrée. Contrairement au suivi de commande (lib/messages/notifier.ts), ces
// événements n'ont pas de trigger DB — tout se fait ici, y compris la boîte
// de réception (pas de commande à observer).

export type CodeEvenementCatalogue =
  | "produit_trouve"
  | "favori_restock"
  | "baisse_prix"
  | "rappel_rentree";

type FamillePreference = "produits_attendus" | "rentree_nouveautes";

const FAMILLE: Record<CodeEvenementCatalogue, FamillePreference> = {
  produit_trouve: "produits_attendus",
  favori_restock: "produits_attendus",
  baisse_prix: "produits_attendus",
  rappel_rentree: "rentree_nouveautes",
};

const PLAFOND_COMMERCIAL_PAR_MOIS = 2;
const FENETRE_PLAFOND_JOURS = 30;

// §7 : 2 notifications commerciales par mois maximum, toutes catégories
// confondues (les 4 événements de ce fichier), compteur glissant par client.
async function sousPlafondCommercial(clientId: number): Promise<boolean> {
  const depuisLe = new Date(Date.now() - FENETRE_PLAFOND_JOURS * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("journal_notifications")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("canal", "push")
    .in("statut", ["envoye", "differe"])
    .in("type", Object.keys(FAMILLE))
    .gte("cree_le", depuisLe);
  return (count ?? 0) < PLAFOND_COMMERCIAL_PAR_MOIS;
}

async function envoyerInboxEvenement(
  clientId: number,
  code: CodeEvenementCatalogue,
  variables: VariablesModele,
  lien: string,
): Promise<void> {
  const { data: modele } = await supabaseAdmin
    .from("modeles_messages")
    .select("titre, contenu")
    .eq("code", code)
    .eq("canal", "inbox")
    .eq("actif", true)
    .maybeSingle();
  if (!modele?.contenu) return;

  await supabaseAdmin.from("messages").insert({
    client_id: clientId,
    type: "info",
    titre: modele.titre ?? "SacAdo",
    corps: rendreModele(modele.contenu, variables),
    lien,
  });
  await journaliserNotification({ clientId, canal: "inbox", type: code, statut: "envoye" });
}

// Best-effort : ne jette jamais.
export async function notifierEvenementClient(params: {
  clientId: number;
  code: CodeEvenementCatalogue;
  variables: VariablesModele;
  lien: string; // page de destination (fiche produit, favoris…)
}): Promise<void> {
  try {
    const { clientId, code, variables, lien } = params;

    // Boîte de réception : toujours, indépendamment de la préférence (filet
    // de sécurité, §7 — la préférence ne vaut que pour le push, §8).
    await envoyerInboxEvenement(clientId, code, variables, lien);

    const famille = FAMILLE[code];
    if (!(await getPreferences(clientId))[famille]) {
      await journaliserNotification({ clientId, canal: "push", type: code, statut: "bloque_preference" });
      return;
    }

    const { data: modele } = await supabaseAdmin
      .from("modeles_messages")
      .select("titre, contenu")
      .eq("code", code)
      .eq("canal", "push")
      .eq("actif", true)
      .maybeSingle();
    if (!modele?.contenu) return;

    if (!(await sousPlafondCommercial(clientId))) {
      await journaliserNotification({
        clientId,
        canal: "push",
        type: code,
        statut: "bloque_preference",
        detail: "plafond commercial mensuel atteint",
      });
      return;
    }

    const titre = modele.titre ?? "SacAdo";
    const corps = rendreModele(modele.contenu, variables);

    if (heureCalmeDakar()) {
      await supabaseAdmin.from("push_differes").insert({
        client_id: clientId,
        commande_id: null,
        code_modele: code,
        titre,
        corps,
        url: lien,
      });
      await journaliserNotification({ clientId, canal: "push", type: code, statut: "differe" });
      return;
    }

    const payload: PushPayload = { title: titre, body: corps, url: lien };
    const resultat = await envoyerPushClient(clientId, payload);
    if (resultat.abonnements > 0) {
      await journaliserNotification({
        clientId,
        canal: "push",
        type: code,
        statut: resultat.echecs >= resultat.abonnements ? "echec" : "envoye",
      });
    }
  } catch (e) {
    console.error("notifierEvenementClient a échoué", e);
  }
}
