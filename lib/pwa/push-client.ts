"use client";

import { useCallback, useEffect, useState } from "react";
import { useIdentite } from "@/lib/local/identite";
import {
  etatPushClient,
  enregistrerAbonnementPushClient,
  supprimerAbonnementPushClient,
} from "@/lib/moi/push-actions";

// État / actions du push côté client, partagés entre le réglage (B5) et
// l'invite affichée après la première commande (B3).

export type EtatPushClientUI =
  | "chargement"
  | "non_supporte" // navigateur sans Web Push
  | "indisponible" // clés VAPID non configurées côté serveur
  | "sans_identite" // pas de jeton : aucune commande passée depuis cet appareil
  | "inactif"
  | "actif"
  | "refuse" // permission navigateur bloquée (irréversible sans réglages)
  | "occupe";

function base64UrlVersUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushClient() {
  const { identite } = useIdentite();
  const [etat, setEtat] = useState<EtatPushClientUI>("chargement");
  const [clePublique, setClePublique] = useState<string | null>(null);

  const jeton = identite?.jeton;
  const telephone = identite?.telephone;

  useEffect(() => {
    let annule = false;
    (async () => {
      const supporte =
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      if (!supporte) {
        if (!annule) setEtat("non_supporte");
        return;
      }
      const infos = await etatPushClient();
      if (annule) return;
      if (!infos.disponible || !infos.clePublique) {
        setEtat("indisponible");
        return;
      }
      setClePublique(infos.clePublique);

      if (!jeton) {
        setEtat("sans_identite");
        return;
      }
      if (Notification.permission === "denied") {
        setEtat("refuse");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!annule) setEtat(sub ? "actif" : "inactif");
    })();
    return () => {
      annule = true;
    };
  }, [jeton]);

  const activer = useCallback(async (): Promise<boolean> => {
    if (!clePublique || !jeton || !telephone) return false;
    setEtat("occupe");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat(permission === "denied" ? "refuse" : "inactif");
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlVersUint8Array(clePublique) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await enregistrerAbonnementPushClient({
        telephone,
        jeton,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (!res.ok) {
        await sub.unsubscribe();
        setEtat("inactif");
        return false;
      }
      setEtat("actif");
      return true;
    } catch {
      setEtat("inactif");
      return false;
    }
  }, [clePublique, jeton, telephone]);

  const desactiver = useCallback(async () => {
    if (!jeton || !telephone) return;
    setEtat("occupe");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supprimerAbonnementPushClient({ telephone, jeton, endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setEtat("inactif");
    } catch {
      setEtat("actif");
    }
  }, [jeton, telephone]);

  return { etat, activer, desactiver };
}
