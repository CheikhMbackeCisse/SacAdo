import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { envoyerPushAdmin } from "@/lib/push";
import { formatPrice } from "@/lib/format";

// Déclenché depuis le checkout public (pas de session admin ici) : prévient
// tous les administrateurs qu'une commande vient d'arriver (PROMPT_ADMIN Lot 2).
// Best-effort — ne jette jamais, une panne de push ne doit jamais faire
// échouer la commande du client.
export async function notifierPushAdminNouvelleCommande(
  commandeId: number,
  nomClient: string,
  total: number,
): Promise<void> {
  try {
    const { data: admins } = await supabaseAdmin.from("admins").select("user_id");
    if (!admins || admins.length === 0) return;

    await Promise.all(
      admins.map((a) =>
        envoyerPushAdmin(a.user_id, {
          title: "Nouvelle commande",
          body: `${nomClient} · ${formatPrice(total)}`,
          url: `/admin/commandes/${commandeId}`,
        }),
      ),
    );
  } catch (e) {
    console.error("notifierPushAdminNouvelleCommande a échoué", e);
  }
}

// Déclenché quand un ajout à une commande en cours est validé (payé à la
// livraison tout de suite, ou confirmé par le webhook Wave) — PROMPT_ADMIN_V2
// Lot 2 : le fondateur doit le voir même s'il n'est pas sur l'onglet Commandes.
export async function notifierPushAdminAjout(commandeId: number, sousTotal: number): Promise<void> {
  try {
    const { data: admins } = await supabaseAdmin.from("admins").select("user_id");
    if (!admins || admins.length === 0) return;

    await Promise.all(
      admins.map((a) =>
        envoyerPushAdmin(a.user_id, {
          title: "Ajout à une commande",
          body: `Commande #${commandeId} · ${formatPrice(sousTotal)}`,
          url: `/admin/commandes/${commandeId}`,
        }),
      ),
    );
  } catch (e) {
    console.error("notifierPushAdminAjout a échoué", e);
  }
}
