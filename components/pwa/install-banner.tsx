"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { onInstallChange, promptInstall, useInstallState } from "@/lib/pwa/install-prompt";
import { estAndroid } from "@/lib/pwa/platform";

// Après un rejet, on ne re-propose pas la bannière avant ce délai — sauf si
// l'utilisateur désinstalle l'app entre-temps (voir plus bas).
const DISMISS_KEY = "sacado_install_dismiss";
const INSTALLED_KEY = "sacado_pwa_installed";
const RE_ASK_MS = 3 * 24 * 60 * 60 * 1000;

const EMPTY_SUBSCRIBE = () => () => {};

// "beforeinstallprompt" n'existe que sur Chrome/Edge/Android — pas de bannière
// sur iOS Safari (l'événement n'y est jamais déclenché). L'option reste
// accessible dans Moi > Paramètres. Sur Android, AndroidInstallInvite prend
// le relais (CORRECTIONS_V11 lot 3) : une seule invitation à la fois.
export function InstallBanner() {
  const { canPrompt, installed } = useInstallState();
  // Masquée par défaut ; révélée après évaluation de l'historique local.
  const [masquee, setMasquee] = useState(true);
  const android = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => estAndroid(navigator.userAgent),
    () => false,
  );

  useEffect(() => {
    const evaluer = () => {
      try {
        // App installée puis désinstallée -> on efface la suppression pour
        // reproposer tout de suite.
        if (window.localStorage.getItem(INSTALLED_KEY) && canPrompt) {
          window.localStorage.removeItem(INSTALLED_KEY);
          window.localStorage.removeItem(DISMISS_KEY);
        }
        if (installed) window.localStorage.setItem(INSTALLED_KEY, "1");
        const rejetLe = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
        setMasquee(Date.now() - rejetLe < RE_ASK_MS);
      } catch {
        setMasquee(false);
      }
    };
    // setTimeout : évite un setState synchrone dans le corps de l'effet.
    const t = setTimeout(evaluer, 0);
    const unsub = onInstallChange(evaluer);
    return () => {
      clearTimeout(t);
      unsub();
    };
  }, [canPrompt, installed]);

  const fermer = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // masqué pour cette session de toute façon
    }
    setMasquee(true);
  };

  const installer = async () => {
    await promptInstall();
    fermer();
  };

  if (installed || !canPrompt || masquee || android) return null;

  return (
    // Desktop (lg+) : l'icône d'installation du header suffit, pas de bandeau
    // (CORRECTIONS_V16 §2.3).
    <div className="fixed inset-x-0 bottom-16 z-40 px-4 pb-2 lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-2xl border border-ink/10 bg-elevated p-3 shadow-lg">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Download size={18} aria-hidden="true" />
        </span>
        <p className="flex-1 text-xs text-ink/80">
          Pour une meilleure expérience, téléchargez l&apos;app
        </p>
        <button
          type="button"
          onClick={installer}
          className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand active:scale-95"
        >
          Installer
        </button>
        <button
          type="button"
          aria-label="Fermer"
          onClick={fermer}
          className="shrink-0 text-ink/40 transition-colors hover:text-ink"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
