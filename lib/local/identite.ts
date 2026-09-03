"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "sacado_identite";
const EVENT = "sacado:identite";
// Flag "Plus tard" de l'écran de bienvenue (voir welcome-screen.tsx) : on
// l'efface aussi à la déconnexion pour que le formulaire de départ revienne.
const ONBOARDING_REPORTE_KEY = "sacado_onboarding_reporte";

// `jeton` : remis par le serveur à la création d'une commande (HMAC du
// client_id, voir lib/client-auth.ts). Exigé pour relire l'historique / les
// messages / la position du client. Absent tant qu'aucune commande n'a été
// passée depuis cet appareil.
export type Identite = { nom: string; telephone: string; jeton?: string };

let cache: Identite | null | undefined;

function read(): Identite | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Identite) : null;
  } catch {
    return null;
  }
}

function getSnapshot(): Identite | null {
  if (cache === undefined) cache = read();
  return cache;
}

function getServerSnapshot(): Identite | null {
  return null;
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// Pas de compte client en v1 : après une commande (ou une recherche manuelle
// par numéro), on retient nom + téléphone sur l'appareil pour retrouver "Mes
// commandes" et la boîte de réception sans redemander à chaque visite.
export function useIdentite() {
  const identite = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setIdentite = useCallback((next: Identite) => {
    cache = next;
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
  }, []);

  const oublier = useCallback(() => {
    cache = null;
    window.localStorage.removeItem(KEY);
    try {
      window.localStorage.removeItem(ONBOARDING_REPORTE_KEY);
    } catch {
      // stockage indisponible : sans effet
    }
    window.dispatchEvent(new CustomEvent(EVENT));
  }, []);

  return { identite, setIdentite, oublier };
}
