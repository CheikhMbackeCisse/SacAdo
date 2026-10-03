"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "sacado_ajout_mode";
const EVENT = "sacado:ajout-mode";

// "Mode ajout" (PROMPT_CLIENT_V2 Lot 4) : la boutique entière (catégories,
// fiches produit, kits) continue de fonctionner normalement, mais tout ce qui
// est ajouté va dans un panier séparé, rattaché à une commande déjà passée.
// `reference` : générée une fois en entrant, sert d'idempotence au lot
// d'ajout (comme CheckoutInput.reference) — stable tant qu'on reste en mode
// ajout pour CETTE commande.
export type AjoutMode = { commandeId: number; jeton: string; reference: string };

let cache: AjoutMode | null | undefined;

function lire(): AjoutMode | null {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.localStorage.getItem(KEY);
    return brut ? (JSON.parse(brut) as AjoutMode) : null;
  } catch {
    return null;
  }
}

function getSnapshot(): AjoutMode | null {
  if (cache === undefined) cache = lire();
  return cache;
}

function getServerSnapshot(): AjoutMode | null {
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

function genererReference(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // contexte non sécurisé (HTTP simple) : repli ci-dessous
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Clé de stockage du panier / panier de kits actif pour une base donnée
// ("sacado_panier", "sacado_kits_panier") : celle de l'ajout en cours si le
// mode est actif, sinon la clé normale. Partagée par lib/local/panier.ts et
// lib/local/kits-panier.ts pour que TOUT ajout (produit seul ou kit) aille au
// même endroit sans qu'aucun appelant n'ait à le savoir.
export function cleActive(base: string, mode: AjoutMode | null): string {
  return mode ? `${base}_ajout_${mode.commandeId}` : base;
}

const BASES_PANIER = ["sacado_panier", "sacado_kits_panier"];

// Fait passer le contenu du panier normal (et du panier de kits) dans celui
// de l'ajout qui démarre : appelée quand le client accepte la relance
// proactive du checkout ("Ajouter à votre commande en cours ?") alors qu'il
// avait déjà commencé à remplir un panier classique — sinon ses articles
// semblent disparaître en arrivant sur /ajout.
function migrerPanierVersAjout(next: AjoutMode) {
  for (const base of BASES_PANIER) {
    try {
      const brut = window.localStorage.getItem(base);
      if (brut && brut !== "[]") {
        window.localStorage.setItem(cleActive(base, next), brut);
        window.localStorage.removeItem(base);
        window.dispatchEvent(new CustomEvent(`sacado:${base}`));
        window.dispatchEvent(new CustomEvent(`sacado:${cleActive(base, next)}`));
      }
    } catch {
      // stockage indisponible : l'ajout démarre simplement à vide
    }
  }
}

export function useAjoutMode() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const entrer = useCallback((commandeId: number, jeton: string, migrerPanierActuel = false): AjoutMode => {
    const next: AjoutMode = { commandeId, jeton, reference: genererReference() };
    if (migrerPanierActuel) migrerPanierVersAjout(next);
    cache = next;
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
    return next;
  }, []);

  // Quitte le mode ajout et vide le panier d'ajout correspondant (produits +
  // kits) : on ne laisse jamais un panier d'ajout fantôme derrière soi.
  const sortir = useCallback(() => {
    const precedent = cache;
    cache = null;
    window.localStorage.removeItem(KEY);
    if (precedent) {
      for (const base of BASES_PANIER) {
        const cle = cleActive(base, precedent);
        try {
          window.localStorage.removeItem(cle);
        } catch {
          // stockage indisponible : sans effet
        }
        window.dispatchEvent(new CustomEvent(`sacado:${cle}`));
      }
    }
    window.dispatchEvent(new CustomEvent(EVENT));
  }, []);

  return { mode, entrer, sortir };
}
