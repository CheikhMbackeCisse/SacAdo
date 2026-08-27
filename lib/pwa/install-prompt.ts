"use client";

import { useSyncExternalStore } from "react";

// Store partagé pour l'invite d'installation PWA. `beforeinstallprompt` peut se
// déclencher très tôt (avant que la page Paramètres ou la bannière ne soit
// montée) : on le capte une fois au niveau module et on le garde sous la main.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  installed = window.matchMedia("(display-mode: standalone)").matches;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    // Si l'événement revient alors qu'on se croyait installé, c'est que
    // l'utilisateur a désinstallé l'app -> on repropose.
    installed = false;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export type InstallState = {
  // true : le navigateur nous laisse déclencher l'invite native maintenant.
  canPrompt: boolean;
  // true : l'app tourne déjà en mode installé (standalone).
  installed: boolean;
};

export function useInstallState(): InstallState {
  const canPrompt = useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  );
  const isInstalled = useSyncExternalStore(
    subscribe,
    () => installed,
    () => false,
  );
  return { canPrompt, installed: isInstalled };
}

export function onInstallChange(cb: () => void) {
  return subscribe(cb);
}

export function wasInstalled() {
  return installed;
}

// Déclenche l'invite native. Retourne le choix de l'utilisateur, ou
// "unavailable" si le navigateur ne propose pas d'invite (iOS Safari, etc.).
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === "accepted") {
    deferred = null;
    notify();
  }
  return outcome;
}
