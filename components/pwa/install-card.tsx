"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Download, Share, SquarePlus } from "lucide-react";
import { promptInstall, useInstallState } from "@/lib/pwa/install-prompt";

const NO_SUBSCRIBE = () => () => {};

type Statut = "idle" | "accepte" | "refuse";

// Bloc "Installer l'app" pour l'écran Paramètres. Toujours visible :
// - app déjà installée (ou invite acceptée) -> confirmation "SacAdo est installé ✓"
// - navigateur qui supporte l'invite (Chrome/Edge/Android) -> bouton qui
//   déclenche l'invite NATIVE du navigateur (aucune fausse barre de progression)
// - iOS Safari -> marche à suivre illustrée (Apple n'expose pas d'invite)
// - autre navigateur -> marche à suivre manuelle
export function InstallCard() {
  const { canPrompt, installed } = useInstallState();
  const [statut, setStatut] = useState<Statut>("idle");
  const ios = useSyncExternalStore(
    NO_SUBSCRIBE,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent),
    () => false,
  );

  const installer = async () => {
    // promptInstall ouvre la boîte de dialogue du navigateur ("Installer
    // SacAdo ? Installer / Annuler") et attend le choix de l'utilisateur.
    const choix = await promptInstall();
    if (choix === "accepted") setStatut("accepte");
    else if (choix === "dismissed") setStatut("refuse");
    // "unavailable" : on laisse le rendu basculer sur la marche à suivre.
  };

  if (installed || statut === "accepte") {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success/10 px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <Check size={18} aria-hidden="true" />
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink">SacAdo est installé ✓</span>
          <span className="text-xs text-ink/55">
            Ouvrez-le depuis votre écran d&apos;accueil, en plein écran.
          </span>
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
          <span className="text-sm font-medium text-ink">Installer l&apos;app</span>
          <span className="text-xs text-ink/55">
            Accès direct depuis l&apos;écran d&apos;accueil, sans passer par le navigateur.
          </span>
        </div>
      </div>

      {canPrompt ? (
        <>
          <button
            type="button"
            onClick={installer}
            className="h-11 rounded-full bg-brand text-sm font-semibold text-on-brand transition-transform active:scale-[0.98]"
          >
            Installer l&apos;app
          </button>
          {statut === "refuse" && (
            <p className="text-xs text-ink/55">
              Installation annulée. Vous pourrez la relancer quand vous voudrez.
            </p>
          )}
        </>
      ) : ios ? (
        <ol className="flex flex-col gap-2 text-xs text-ink/75">
          <li className="flex items-center gap-2">
            <Etape n={1} />
            <span className="flex items-center gap-1">
              Touchez <Share size={14} aria-hidden="true" className="text-brand" /> en bas de
              Safari
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Etape n={2} />
            <span className="flex items-center gap-1">
              Choisissez <SquarePlus size={14} aria-hidden="true" className="text-brand" />
              «&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;»
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Etape n={3} />
            <span>Touchez «&nbsp;Ajouter&nbsp;»</span>
          </li>
        </ol>
      ) : (
        <p className="text-xs text-ink/70">
          Dans le menu de votre navigateur (⋮), choisissez «&nbsp;Ajouter à l&apos;écran
          d&apos;accueil&nbsp;» ou «&nbsp;Installer l&apos;application&nbsp;».
        </p>
      )}
    </section>
  );
}

function Etape({ n }: { n: number }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
      {n}
    </span>
  );
}
