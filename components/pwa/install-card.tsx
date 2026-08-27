"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Download, Share } from "lucide-react";
import { promptInstall, useInstallState } from "@/lib/pwa/install-prompt";

const NO_SUBSCRIBE = () => () => {};

// Bloc "Installer l'application" pour l'écran Paramètres. Toujours visible :
// - app déjà installée -> confirmation
// - navigateur qui supporte l'invite (Chrome/Edge/Android) -> bouton Installer
// - sinon (iOS Safari, etc.) -> marche à suivre manuelle
export function InstallCard() {
  const { canPrompt, installed } = useInstallState();
  const [enCours, setEnCours] = useState(false);
  const ios = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false,
  );

  const installer = async () => {
    setEnCours(true);
    await promptInstall();
    setEnCours(false);
  };

  if (installed) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <Check size={18} aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">Application installée</span>
          <span className="text-xs text-ink/55">SacAdo est sur votre écran d&apos;accueil.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand/5 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Download size={18} aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">Installer l&apos;application</span>
          <span className="text-xs text-ink/55">
            Accès direct depuis l&apos;écran d&apos;accueil, sans passer par le navigateur.
          </span>
        </div>
      </div>

      {canPrompt ? (
        <button
          type="button"
          onClick={installer}
          disabled={enCours}
          className="h-11 rounded-full bg-brand text-sm font-semibold text-on-brand transition-transform active:scale-[0.98] disabled:opacity-70"
        >
          Installer maintenant
        </button>
      ) : ios ? (
        <p className="flex items-start gap-1.5 text-xs text-ink/70">
          <Share size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Dans Safari : bouton Partager, puis «&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;».
        </p>
      ) : (
        <p className="text-xs text-ink/70">
          Dans le menu de votre navigateur (⋮), choisissez «&nbsp;Ajouter à l&apos;écran
          d&apos;accueil&nbsp;» ou «&nbsp;Installer l&apos;application&nbsp;».
        </p>
      )}
    </section>
  );
}
