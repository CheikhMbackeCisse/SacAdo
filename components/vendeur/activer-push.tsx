"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import {
  getEtatPush,
  enregistrerAbonnementPush,
  supprimerAbonnementPush,
} from "@/lib/vendeur/push-actions";

type Etat = "chargement" | "non_supporte" | "indisponible" | "inactif" | "actif" | "refuse" | "occupe";

function base64UrlVersUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function ActiverPush() {
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
      const infos = await getEtatPush();
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
      const res = await enregistrerAbonnementPush({
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
        await supprimerAbonnementPush(sub.endpoint);
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
      <p className="flex items-center gap-2 rounded-2xl border border-[#001314]/10 bg-white px-4 py-3 text-xs text-[#001314]/55">
        <BellOff size={15} aria-hidden="true" />
        Notifications bloquées dans le navigateur. Autorisez-les dans les réglages du site
        pour être prévenu des préparations.
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
          ? "border-[#16A34A]/30 bg-[#16A34A]/[0.06] text-[#001314]"
          : "border-[#001314]/10 bg-white text-[#001314] hover:border-[#0B3D91]/40"
      }`}
    >
      {actif ? (
        <BellRing size={17} className="shrink-0 text-[#16A34A]" aria-hidden="true" />
      ) : (
        <Bell size={17} className="shrink-0 text-[#0B3D91]" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">
          {actif ? "Notifications activées" : "Activer les notifications"}
        </span>
        <span className="block text-xs text-[#001314]/50">
          {etat === "occupe"
            ? "…"
            : actif
              ? "Vous êtes prévenu sur ce téléphone dès qu'une préparation arrive. Touchez pour désactiver."
              : "Être prévenu sur ce téléphone dès qu'une préparation arrive, même l'app fermée."}
        </span>
      </span>
    </button>
  );
}
