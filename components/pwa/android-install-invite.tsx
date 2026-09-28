"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, Download, Menu, MoreVertical } from "lucide-react";
import { promptInstall, useInstallState } from "@/lib/pwa/install-prompt";
import {
  detecterNavigateurAndroid,
  estAndroid,
  estNavigateurEmbarque,
  type NavigateurAndroid,
} from "@/lib/pwa/platform";

// Invitation d'installation Android (CORRECTIONS_V11 lot 3) : à l'arrivée
// dans l'app, sur Android uniquement, tant qu'elle n'est pas déjà installée.
// Distincte de InstallBanner (bandeau bas, iOS/desktop/repli général) — les
// deux ne doivent jamais se superposer : InstallBanner s'efface sur Android
// (voir lib/pwa/platform.ts + install-banner.tsx).
const REPORTE_KEY = "sacado_install_android_reporte";
const RAPPEL_MS = 7 * 24 * 60 * 60 * 1000;

function reporteRecemment(): boolean {
  try {
    const brut = window.localStorage.getItem(REPORTE_KEY);
    if (!brut) return false;
    return Date.now() - Number(brut) < RAPPEL_MS;
  } catch {
    return false;
  }
}

const EMPTY_SUBSCRIBE = () => () => {};

export function AndroidInstallInvite() {
  const pathname = usePathname();
  const { canPrompt, installed } = useInstallState();
  const [ferme, setFerme] = useState(false);
  const [copie, setCopie] = useState(false);

  // Rendu client uniquement : l'user-agent n'existe pas côté serveur, et on
  // évite un flash pour les visiteurs iOS/desktop (jamais concernés).
  const monte = useSyncExternalStore(EMPTY_SUBSCRIBE, () => true, () => false);
  const android = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => estAndroid(navigator.userAgent),
    () => false,
  );
  const navigateur = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => detecterNavigateurAndroid(navigator.userAgent),
    () => "chrome" as NavigateurAndroid,
  );

  // Jamais pendant une commande ou un paiement.
  const dansCommande = pathname?.startsWith("/checkout") || pathname?.startsWith("/paiement");

  const ouvert = monte && android && !installed && !ferme && !dansCommande && !reporteRecemment();

  const reporter = useCallback(() => {
    try {
      window.localStorage.setItem(REPORTE_KEY, String(Date.now()));
    } catch {
      // stockage indisponible : masqué pour cette session de toute façon
    }
    setFerme(true);
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") reporter();
    };
    const root = document.documentElement;
    const avant = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = avant;
    };
  }, [ouvert, reporter]);

  if (!ouvert) return null;

  const installer = async () => {
    const resultat = await promptInstall();
    if (resultat === "accepted") setFerme(true);
  };

  const copierLien = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // presse-papier indisponible : le lien reste affiché, copiable à la main
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-android-titre"
      className="fixed inset-0 z-[125] flex items-center justify-center bg-ink/40 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-surface p-5 text-center shadow-xl">
        <Image
          src="/images/logo-sacado-fond-bleu.webp"
          alt="SacAdo"
          width={64}
          height={64}
          className="mx-auto size-16 rounded-2xl object-cover shadow-lg shadow-[#0B3D91]/20"
          unoptimized
        />
        <h2 id="install-android-titre" className="mt-3 font-heading text-base font-bold text-ink">
          Téléchargez l&apos;application pour une meilleure expérience d&apos;utilisation
        </h2>

        <div className="mt-4">
          {estNavigateurEmbarque(navigateur) ? (
            <NavigateurEmbarqueEtapes copie={copie} onCopier={copierLien} />
          ) : canPrompt ? (
            <button
              type="button"
              onClick={installer}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-on-brand transition-transform active:scale-95"
            >
              <Download size={16} aria-hidden="true" />
              Installer
            </button>
          ) : (
            <NavigateurEtapes navigateur={navigateur} />
          )}
        </div>

        <button
          type="button"
          onClick={reporter}
          className="mt-4 h-10 w-full rounded-full text-sm font-medium text-ink/55 transition-colors hover:text-ink/85"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}

function Etape({ n }: { n: number }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand">
      {n}
    </span>
  );
}

// Marche à suivre propre à chaque navigateur (repli quand beforeinstallprompt
// n'est pas disponible). Libellés à revérifier sur les versions actuelles des
// navigateurs avant de les figer définitivement (CORRECTIONS_V11 lot 3).
function NavigateurEtapes({ navigateur }: { navigateur: NavigateurAndroid }) {
  const etapes: { icon: React.ReactNode; texte: string }[] =
    navigateur === "samsung"
      ? [
          { icon: <Menu size={15} className="text-brand" aria-hidden="true" />, texte: "Touchez ≡ en bas de l'écran" },
          { icon: null, texte: "Choisissez « Ajouter la page à »" },
          { icon: null, texte: "Puis « Écran d'accueil »" },
        ]
      : navigateur === "firefox"
        ? [
            { icon: <MoreVertical size={15} className="text-brand" aria-hidden="true" />, texte: "Touchez ⋮ en haut à droite" },
            { icon: null, texte: "Choisissez « Installer »" },
          ]
        : navigateur === "opera"
          ? [
              { icon: <MoreVertical size={15} className="text-brand" aria-hidden="true" />, texte: "Touchez ⋮ en haut à droite" },
              { icon: null, texte: "Choisissez « Ajouter à l'écran d'accueil »" },
            ]
          : [
              // Chrome, Edge : même menu ⋮ Chromium.
              { icon: <MoreVertical size={15} className="text-brand" aria-hidden="true" />, texte: "Touchez ⋮ en haut à droite" },
              { icon: null, texte: "Choisissez « Installer l'application » (ou « Ajouter à l'écran d'accueil »)" },
            ];

  return (
    <ol className="flex flex-col gap-2 text-left text-xs text-ink/75">
      {etapes.map((etape, i) => (
        <li key={i} className="flex items-center gap-2">
          <Etape n={i + 1} />
          <span className="flex items-center gap-1.5">
            {etape.icon}
            {etape.texte}
          </span>
        </li>
      ))}
    </ol>
  );
}

// Navigateur intégré (Facebook, Instagram, TikTok…) : l'installation y est
// techniquement impossible, on explique comment ouvrir la page dans Chrome.
function NavigateurEmbarqueEtapes({ copie, onCopier }: { copie: boolean; onCopier: () => void }) {
  return (
    <div className="flex flex-col gap-3 text-left">
      <ol className="flex flex-col gap-2 text-xs text-ink/75">
        <li className="flex items-center gap-2">
          <Etape n={1} />
          <span className="flex items-center gap-1.5">
            <MoreVertical size={15} className="text-brand" aria-hidden="true" />
            Touchez ⋮ en haut à droite
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Etape n={2} />
          <span>Choisissez « Ouvrir dans le navigateur »</span>
        </li>
      </ol>
      <button
        type="button"
        onClick={onCopier}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-ink/15 text-sm font-medium text-ink/70 transition-colors active:scale-95"
      >
        {copie ? (
          <>
            <Check size={15} className="text-success" aria-hidden="true" />
            Lien copié
          </>
        ) : (
          <>
            <Copy size={15} aria-hidden="true" />
            Copier le lien
          </>
        )}
      </button>
    </div>
  );
}
