"use client";

// État local de l'invite « Tu veux qu'on te prévienne… ? » (push ou, sur iPhone
// non installé, invitation à installer) — TACHE_notifications_client.md §1.
//
// - `sacado_commande_fraiche` (sessionStorage) : id de la commande qui vient
//   d'être validée. Survit à un aller-retour Wave (même onglet), consommé une
//   seule fois — une revisite plus tard de /suivi/<id> ne redéclenche rien.
// - `sacado_push_invite_reports` (localStorage) : 0, 1 ou 2. L'invite se montre
//   tant que < 2 ; "Plus tard" l'incrémente ; "Oui" (ou son équivalent iOS) la
//   fixe à 2 directement.

const FRESH_KEY = "sacado_commande_fraiche";
const REPORTS_KEY = "sacado_push_invite_reports";
const REPORTS_MAX = 2;

export function marquerCommandeFraiche(commandeId: number): void {
  try {
    window.sessionStorage.setItem(FRESH_KEY, String(commandeId));
  } catch {
    // sessionStorage indisponible : l'invite ne se montrera simplement pas.
  }
}

// Vrai une seule fois par commande : la lecture consomme le drapeau.
export function estCommandeFraiche(commandeId: number): boolean {
  try {
    const valeur = window.sessionStorage.getItem(FRESH_KEY);
    if (valeur !== String(commandeId)) return false;
    window.sessionStorage.removeItem(FRESH_KEY);
    return true;
  } catch {
    return false;
  }
}

export function invitePushEpuisee(): boolean {
  try {
    return Number(window.localStorage.getItem(REPORTS_KEY) || 0) >= REPORTS_MAX;
  } catch {
    return true;
  }
}

export function reporterInvitePush(): void {
  try {
    const actuel = Number(window.localStorage.getItem(REPORTS_KEY) || 0);
    window.localStorage.setItem(REPORTS_KEY, String(Math.min(REPORTS_MAX, actuel + 1)));
  } catch {
    // sans effet : au pire l'invite se reproposera une fois de trop.
  }
}

export function cloreInvitePush(): void {
  try {
    window.localStorage.setItem(REPORTS_KEY, String(REPORTS_MAX));
  } catch {
    // ignoré
  }
}
