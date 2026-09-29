"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Download } from "lucide-react";
import { promptInstall, useInstallState } from "@/lib/pwa/install-prompt";
import { estAndroid } from "@/lib/pwa/platform";
import { estRobot } from "@/lib/pwa/bot-detection";
import { compterPageVue, estVisitePub, marquerVisitePub } from "@/lib/pwa/ads-session";

// Invitation d'installation Android (CORRECTIONS_V11 lot 3, réécrite pour les
// pubs Google Ads — LOT_PUB_ANDROID §1) : à l'arrivée dans l'app, sur Android
// uniquement, tant qu'elle n'est pas déjà installée.
// Distincte de InstallBanner (bandeau bas, iOS/desktop/repli général) — les
// deux ne doivent jamais se superposer : InstallBanner s'efface sur Android
// (voir lib/pwa/platform.ts + install-banner.tsx).
//
// Règle stricte (audit Google Ads) : cette fenêtre ne montre JAMAIS d'étapes
// ni d'explication. Elle ne s'affiche QUE si le navigateur a réellement
// déclenché `beforeinstallprompt` (bouton = installation native en un
// toucher) ; sinon rien n'apparaît du tout — l'explication détaillée reste
// disponible derrière le bouton d'installation du header (InstallHeaderButton),
// que l'utilisateur ouvre lui-même.
const REPORTE_KEY = "sacado_install_android_reporte";
const RAPPEL_MS = 7 * 24 * 60 * 60 * 1000;
// Délai d'attente de `beforeinstallprompt` après le démarrage : au-delà,
// on abandonne pour cette visite plutôt que d'attendre indéfiniment.
const ATTENTE_PROMPT_MS = 5000;

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
  const [essaiExpire, setEssaiExpire] = useState(false);
  const [bloqueParPub, setBloqueParPub] = useState(false);
  // Robots/outils de test (Search Console, Lighthouse, crawlers pub) : jamais
  // cette fenêtre, quelle que soit la plateforme.
  const robot = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => estRobot(navigator.userAgent, navigator.webdriver === true),
    () => false,
  );

  // Rendu client uniquement : l'user-agent n'existe pas côté serveur, et on
  // évite un flash pour les visiteurs iOS/desktop (jamais concernés).
  const monte = useSyncExternalStore(EMPTY_SUBSCRIBE, () => true, () => false);
  const android = useSyncExternalStore(
    EMPTY_SUBSCRIBE,
    () => estAndroid(navigator.userAgent),
    () => false,
  );

  // Visiteur venu d'une pub (gclid/gbraid/wbraid/utm_source) : jamais sur la
  // 1re page vue de la session, au plus tôt à partir de la 2e. setTimeout :
  // évite un setState synchrone dans le corps de l'effet.
  useEffect(() => {
    const t = setTimeout(() => {
      marquerVisitePub(window.location.search);
      const pageVues = compterPageVue(pathname ?? "/");
      setBloqueParPub(estVisitePub() && pageVues < 2);
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  // Attente de `beforeinstallprompt` : si rien n'arrive dans les 5 s, on
  // abandonne pour cette visite (jamais de repli avec des étapes).
  useEffect(() => {
    if (canPrompt || essaiExpire) return;
    const t = setTimeout(() => setEssaiExpire(true), ATTENTE_PROMPT_MS);
    return () => clearTimeout(t);
  }, [canPrompt, essaiExpire]);

  // Jamais pendant une commande ou un paiement.
  const dansCommande = pathname?.startsWith("/checkout") || pathname?.startsWith("/paiement");

  const ouvert =
    monte &&
    android &&
    !robot &&
    canPrompt &&
    !essaiExpire &&
    !installed &&
    !ferme &&
    !dansCommande &&
    !bloqueParPub &&
    !reporteRecemment();

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

        <button
          type="button"
          onClick={installer}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-on-brand transition-transform active:scale-95"
        >
          <Download size={16} aria-hidden="true" />
          Télécharger l&apos;application
        </button>

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
