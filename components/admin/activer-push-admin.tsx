"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import {
  getEtatPushAdmin,
  enregistrerAbonnementPushAdmin,
  supprimerAbonnementPushAdmin,
} from "@/lib/admin/push-actions";

type Etat = "chargement" | "non_supporte" | "indisponible" | "inactif" | "actif" | "refuse" | "occupe";

function base64UrlVersUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Même mécanique que components/vendeur/activer-push.tsx, pour le fondateur :
// prévenu dès qu'une commande arrive, même l'app admin fermée (PROMPT_ADMIN Lot 2).
export function ActiverPushAdmin() {
  const [etat, setEtat] = useState<Etat>("chargement");
  const [clePublique, setClePublique] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      const supporte =
        "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supporte) {
        if (!annule) setEtat("non_supporte");
        return;
      }
      const infos = await getEtatPushAdmin();
      if (annule) return;
      if (!infos.disponible || !infos.clePublique) {
        setEtat("indisponible");
        return;
      }
      setClePublique(infos.clePublique);

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
  }, []);

  const activer = async () => {
    if (!clePublique) return;
    setEtat("occupe");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat(permission === "denied" ? "refuse" : "inactif");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlVersUint8Array(clePublique) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await enregistrerAbonnementPushAdmin({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (!res.ok) {
        await sub.unsubscribe();
        setEtat("inactif");
        return;
      }
      setEtat("actif");
    } catch {
      setEtat("inactif");
    }
  };

  const desactiver = async () => {
    setEtat("occupe");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supprimerAbonnementPushAdmin(sub.endpoint);
        await sub.unsubscribe();
      }
      setEtat("inactif");
    } catch {
      setEtat("actif");
    }
  };

  if (etat === "chargement" || etat === "non_supporte" || etat === "indisponible") return null;

  if (etat === "refuse") {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-xs text-ink/55">
        <BellOff size={15} aria-hidden="true" />
        Notifications bloquées dans le navigateur. Autorisez-les dans les réglages du site
        pour être prévenu des nouvelles commandes.
      </p>
    );
  }

  const actif = etat === "actif";
  return (
    <button
      type="button"
      onClick={actif ? desactiver : activer}
      disabled={etat === "occupe"}
      className={`flex w-full items-center gap-2.5 rounded-2xl border px-4 py-3 text-left text-sm transition-colors disabled:opacity-50 ${
        actif
          ? "border-success/30 bg-success/[0.06] text-ink"
          : "border-ink/10 bg-white text-ink hover:border-brand/40"
      }`}
    >
      {actif ? (
        <BellRing size={17} className="shrink-0 text-success" aria-hidden="true" />
      ) : (
        <Bell size={17} className="shrink-0 text-brand" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {actif ? "Notifications activées" : "Activer les notifications"}
        </span>
        <span className="block text-xs text-ink/50">
          {etat === "occupe"
            ? "…"
            : actif
              ? "Vous êtes prévenu sur ce téléphone dès qu'une commande arrive. Touchez pour désactiver."
              : "Être prévenu sur ce téléphone dès qu'une commande arrive, même l'app fermée."}
        </span>
      </span>
    </button>
  );
}
