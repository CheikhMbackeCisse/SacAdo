"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

// Garde de navigation (CONFIRMATION_RETOUR.md) : demande confirmation avant de
// quitter une page qui contient un travail non enregistré, et UNIQUEMENT dans
// ce cas. Un formulaire déclare son état « modifié » via useUnsavedChanges ;
// la garde intercepte alors les clics sur les liens internes, le bouton retour
// du navigateur (best effort) et la fermeture d'onglet.

type GuardContexte = {
  registerBlocker: () => () => void;
  confirmLeave: () => Promise<boolean>;
  allowNextNavigation: () => void;
};

const Contexte = createContext<GuardContexte | null>(null);

const MESSAGE = "Quitter cette page ? Vos informations non enregistrées seront perdues.";

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [blockers, setBlockers] = useState(0);
  const [demande, setDemande] = useState<{ resolve: (v: boolean) => void } | null>(null);

  const bloque = blockers > 0;
  const bypass = useRef(false);

  const registerBlocker = useCallback(() => {
    setBlockers((n) => n + 1);
    return () => setBlockers((n) => Math.max(0, n - 1));
  }, []);

  const allowNextNavigation = useCallback(() => {
    bypass.current = true;
    window.setTimeout(() => {
      bypass.current = false;
    }, 400);
  }, []);

  const confirmLeave = useCallback((): Promise<boolean> => {
    if (!bloque || bypass.current) return Promise.resolve(true);
    if (demande) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => setDemande({ resolve }));
  }, [bloque, demande]);

  const repondre = useCallback((valeur: boolean) => {
    setDemande((actuel) => {
      actuel?.resolve(valeur);
      return null;
    });
  }, []);

  // Référence toujours à jour de confirmLeave, pour que les effets « listeners »
  // ne dépendent que de `bloque` (et ne se rebranchent pas à chaque dialogue).
  const confirmLeaveRef = useRef(confirmLeave);
  useEffect(() => {
    confirmLeaveRef.current = confirmLeave;
  });

  // 1. Fermeture / rechargement de l'onglet : dialogue natif du navigateur.
  useEffect(() => {
    if (!bloque) return;
    const handler = (event: BeforeUnloadEvent) => {
      if (bypass.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [bloque]);

  // 2. Clic sur un lien interne (bottom nav, header, « Espace client », etc.).
  useEffect(() => {
    if (!bloque) return;
    const onClick = (event: MouseEvent) => {
      if (bypass.current || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const cible = event.target as Element | null;
      const lien = cible?.closest?.("a");
      const href = lien?.getAttribute("href");
      if (!lien || !href || href.startsWith("#")) return;
      if (lien.target === "_blank" || lien.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      const ici = window.location.pathname + window.location.search;
      if (url.pathname + url.search === ici) return;

      event.preventDefault();
      event.stopPropagation();
      confirmLeaveRef.current().then((ok) => {
        if (!ok) return;
        bypass.current = true;
        window.setTimeout(() => {
          bypass.current = false;
        }, 400);
        router.push(url.pathname + url.search + url.hash);
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [bloque, router]);

  // 3. Bouton retour navigateur / Android (best effort, ne doit rien casser).
  //    Entrée sentinelle : le premier « retour » revient dessus (même URL) et
  //    déclenche le dialogue au lieu de quitter.
  useEffect(() => {
    if (!bloque) return;
    window.history.pushState({ __sacadoGuard: true }, "");

    const onPop = () => {
      if (bypass.current) return;
      window.history.pushState({ __sacadoGuard: true }, "");
      confirmLeaveRef.current().then((ok) => {
        if (!ok) return;
        bypass.current = true;
        window.setTimeout(() => {
          bypass.current = false;
        }, 400);
        window.history.go(-2);
      });
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      const state = window.history.state as { __sacadoGuard?: boolean } | null;
      if (!bypass.current && state?.__sacadoGuard) {
        bypass.current = true;
        window.setTimeout(() => {
          bypass.current = false;
        }, 400);
        window.history.back();
      }
    };
  }, [bloque]);

  // Verrou du scroll + Échap = « Rester » pendant le dialogue.
  useEffect(() => {
    if (!demande) return;
    const root = document.documentElement;
    const avant = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") repondre(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = avant;
      window.removeEventListener("keydown", onKey);
    };
  }, [demande, repondre]);

  return (
    <Contexte.Provider value={{ registerBlocker, confirmLeave, allowNextNavigation }}>
      {children}
      {demande && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guard-titre"
          className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/40 p-4"
        >
          <div className="w-full max-w-xs rounded-2xl bg-surface p-5 shadow-xl">
            <p id="guard-titre" className="text-sm font-semibold text-ink">
              {MESSAGE}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => repondre(false)}
                className="flex h-10 flex-1 items-center justify-center rounded-full border border-ink/15 text-sm font-medium text-ink"
              >
                Rester
              </button>
              <button
                type="button"
                onClick={() => repondre(true)}
                className="flex h-10 flex-1 items-center justify-center rounded-full bg-ink text-sm font-semibold text-surface"
              >
                Quitter
              </button>
            </div>
          </div>
        </div>
      )}
    </Contexte.Provider>
  );
}

// Déclare que la page contient un travail non enregistré tant que `actif` est
// vrai. À passer `false` dès que le formulaire est soumis / vidé.
export function useUnsavedChanges(actif: boolean) {
  const ctx = useContext(Contexte);
  useEffect(() => {
    if (!actif || !ctx) return;
    return ctx.registerBlocker();
  }, [actif, ctx]);
}

// Pour un bouton explicite « Annuler » / « Retour » : renvoie une fonction qui
// résout `true` si l'utilisateur accepte de quitter (ou s'il n'y a rien à
// perdre).
export function useConfirmLeave(): () => Promise<boolean> {
  const ctx = useContext(Contexte);
  return useCallback(() => (ctx ? ctx.confirmLeave() : Promise.resolve(true)), [ctx]);
}

// Autorise la PROCHAINE navigation programmatique à passer sans confirmation
// (ex. redirection vers Wave après avoir créé la commande).
export function useAllowNextNavigation(): () => void {
  const ctx = useContext(Contexte);
  return useCallback(() => ctx?.allowNextNavigation(), [ctx]);
}
