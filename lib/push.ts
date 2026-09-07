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

type Abonnement = { id: number; endpoint: string; p256dh: string; auth: string };

// Envoie une notif à tous les appareils abonnés d'un vendeur. Nettoie les
// abonnements devenus invalides (404 / 410). Ne jette jamais.
export async function envoyerPushVendeur(vendeurId: string, payload: PushPayload): Promise<void> {
  try {
    if (!configurer()) return;

    const { data } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("vendeur_id", vendeurId);
    const abonnements = (data ?? []) as Abonnement[];
    if (abonnements.length === 0) return;

    const corps = JSON.stringify(payload);
    const perimes: number[] = [];

    await Promise.all(
      abonnements.map(async (a) => {
        try {
          await webpush.sendNotification(
            { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
            corps,
          );
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) perimes.push(a.id);
          else console.error("Push: envoi échoué", code, e);
        }
      }),
    );

    if (perimes.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", perimes);
    }
  } catch (e) {
    console.error("envoyerPushVendeur a échoué", e);
  }
}
