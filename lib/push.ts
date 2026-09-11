import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Envoi des notifications push (Web Push / VAPID). Canal d'appoint : si les clés
// ne sont pas configurées, tout est simplement inactif (aucune erreur).

let configure = false;

function cles(): { publique: string; privee: string; sujet: string } | null {
  const publique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privee = process.env.VAPID_PRIVATE_KEY;
  if (!publique || !privee) return null;
  const sujet = process.env.VAPID_SUBJECT || "mailto:unishopsn@gmail.com";
  return { publique, privee, sujet };
}

export function pushDisponible(): boolean {
  return cles() !== null;
}

function configurer(): boolean {
  if (configure) return true;
  const k = cles();
  if (!k) return false;
  webpush.setVapidDetails(k.sujet, k.publique, k.privee);
  configure = true;
  return true;
}

export type PushPayload = { title: string; body: string; url: string };

// Résultat d'un envoi, pour le journal (B7) : 0 abonnement n'est pas un échec
// (le destinataire n'a simplement pas activé le push), tout le reste si.
export type ResultatPush = { abonnements: number; echecs: number };

type Abonnement = { id: number; endpoint: string; p256dh: string; auth: string };

// Envoie une notif à tous les abonnements d'un destinataire (une ligne = un
// appareil). Nettoie les abonnements devenus invalides (404 / 410). Ne jette
// jamais : la push ne doit jamais faire échouer l'action métier qui la déclenche.
async function envoyerA(
  table: string,
  colonne: string,
  valeur: string | number,
  payload: PushPayload,
): Promise<ResultatPush> {
  try {
    if (!configurer()) return { abonnements: 0, echecs: 0 };

    const { data } = await supabaseAdmin
      .from(table)
      .select("id, endpoint, p256dh, auth")
      .eq(colonne, valeur);
    const abonnements = (data ?? []) as Abonnement[];
    if (abonnements.length === 0) return { abonnements: 0, echecs: 0 };

    const corps = JSON.stringify(payload);
    const perimes: number[] = [];
    let echecs = 0;

    await Promise.all(
      abonnements.map(async (a) => {
        try {
          await webpush.sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
            corps,
          );
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            perimes.push(a.id);
          } else {
            echecs += 1;
            console.error("Push: envoi échoué", code, e);
          }
        }
      }),
    );

    if (perimes.length > 0) {
      await supabaseAdmin.from(table).delete().in("id", perimes);
    }

    // Un abonnement périmé et nettoyé n'est pas un « échec » à surveiller côté
    // dashboard (c'est le nettoyage qui marche comme prévu) : seuls les vrais
    // échecs d'envoi comptent.
    return { abonnements: abonnements.length, echecs };
  } catch (e) {
    console.error(`envoyerA(${table}) a échoué`, e);
    return { abonnements: 0, echecs: 0 };
  }
}

// Vendeur / fournisseur (préparations) — table push_subscriptions.
export async function envoyerPushVendeur(
  vendeurId: string,
  payload: PushPayload,
): Promise<ResultatPush> {
  return envoyerA("push_subscriptions", "vendeur_id", vendeurId, payload);
}

// Client (suivi de commande, produits attendus…) — table abonnements_push_client.
export async function envoyerPushClient(
  clientId: number,
  payload: PushPayload,
): Promise<ResultatPush> {
  return envoyerA("abonnements_push_client", "client_id", clientId, payload);
}
