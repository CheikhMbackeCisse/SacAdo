"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Share, X } from "lucide-react";
import { promptInstall, useInstallState } from "@/lib/pwa/install-prompt";

// Icône « installer l'app » du header, avec un point lumineux animé pour
// inciter (CORRECTIONS_V7 §3). Purement incitatif : jamais bloquant.
// Disparaît quand l'app tourne en mode installé ; réapparaît si l'app est
// désinstallée (l'événement beforeinstallprompt repasse `installed` à false).
export function InstallHeaderButton() {
  const { canPrompt, installed } = useInstallState();
  const [ouvert, setOuvert] = useState(false);

  if (installed) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        aria-label="Installer l'application"
        className="relative shrink-0 rounded-full p-2 text-ink transition-colors duration-150 hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-90"
      >
        <Download size={22} aria-hidden="true" />
        <span aria-hidden="true" className="absolute right-1.5 top-1.5 flex size-2">
          <span className="animate-beacon absolute inline-flex size-2 rounded-full bg-brand" />
          <span className="relative inline-flex size-2 rounded-full bg-brand" />
        </span>
      </button>

      {ouvert && <InstallSheet canPrompt={canPrompt} onClose={() => setOuvert(false)} />}
    </>
  );
}

function InstallSheet({
  canPrompt,
  onClose,
}: {
  canPrompt: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const installerNatif = async () => {
    await promptInstall();
    onClose();
  };

  // Portail vers <body> : le header porte un backdrop-filter, qui en fait un
  // bloc contenant des enfants `fixed` (la modale serait sinon ancrée dans la
  // barre de 64px et rognée). InstallSheet n'est monté qu'après un clic, donc
  // toujours côté client — document.body est disponible.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-titre"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Download size={18} aria-hidden="true" />
            </span>
            <h2 id="install-titre" className="font-heading text-base font-bold text-ink">
              Installer SacAdo
            </h2>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="-mr-1 -mt-1 shrink-0 rounded-full p-1 text-ink/40 transition-colors hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-3 text-sm text-ink/70">
          Ajoutez SacAdo à votre écran d&apos;accueil pour l&apos;ouvrir comme une appli, sans
          passer par un store. Vous pouvez continuer à commander sans l&apos;installer.
        </p>

        {canPrompt && (
          <button
            type="button"
            onClick={installerNatif}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand active:scale-95"
          >
            Installer maintenant
          </button>
        )}

        <ul className="mt-4 flex flex-col gap-2 text-xs text-ink/60">
          <li className="flex gap-2">
            <Share size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Sur iPhone (Safari) : touchez <span className="font-medium text-ink">Partager</span>,
              puis <span className="font-medium text-ink">« Sur l&apos;écran d&apos;accueil »</span>.
            </span>
          </li>
          <li className="flex gap-2">
            <Download size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Sur ordinateur : cliquez sur l&apos;icône d&apos;installation dans la barre
              d&apos;adresse du navigateur.
            </span>
          </li>
        </ul>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-10 w-full rounded-full text-sm font-medium text-ink/55 transition-colors hover:text-ink/85"
        >
          Plus tard
        </button>
      </div>
    </div>,
    document.body,
  );
}
