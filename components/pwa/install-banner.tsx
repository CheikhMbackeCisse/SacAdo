"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const SEEN_KEY = "sacado_install_banner_vu";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// "beforeinstallprompt" n'existe que sur Chrome/Edge/Android — pas de
// bannière sur iOS Safari (l'événement n'y est jamais déclenché), conforme à
// CLAUDE.md qui ne demande rien de plus pour la v1.
export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(SEEN_KEY)) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const fermer = () => {
    setVisible(false);
    window.localStorage.setItem(SEEN_KEY, "1");
  };

  const installer = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    fermer();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 px-4 pb-2 lg:bottom-0">
      <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3 shadow-lg">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Download size={18} aria-hidden="true" />
        </span>
        <p className="flex-1 text-xs text-ink/80">Installez SacAdo sur votre téléphone</p>
        <button
          type="button"
          onClick={installer}
          className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-surface active:scale-95"
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
