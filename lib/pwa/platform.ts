// Détection plateforme/navigateur pour l'invitation d'installation Android
// (CORRECTIONS_V11 lot 3). Pure, testable — ne touche jamais au DOM.

export type NavigateurAndroid =
  | "chrome"
  | "samsung"
  | "firefox"
  | "opera"
  | "edge"
  | "embarque_facebook"
  | "embarque_instagram"
  | "embarque_tiktok";

export function estAndroid(userAgent: string): boolean {
  return /android/i.test(userAgent);
}

// Ordre important : plusieurs navigateurs Android embarquent un moteur Chrome
// et portent donc "Chrome/" dans leur UA — les identifiants plus spécifiques
// doivent être testés en premier, "chrome" reste le repli par défaut.
export function detecterNavigateurAndroid(userAgent: string): NavigateurAndroid {
  if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return "embarque_facebook";
  if (/Instagram/i.test(userAgent)) return "embarque_instagram";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(userAgent)) return "embarque_tiktok";
  if (/SamsungBrowser/i.test(userAgent)) return "samsung";
  if (/OPR\/|Opera/i.test(userAgent)) return "opera";
  if (/EdgA\//i.test(userAgent)) return "edge";
  if (/Firefox/i.test(userAgent)) return "firefox";
  return "chrome";
}

export function estNavigateurEmbarque(navigateur: NavigateurAndroid): boolean {
  return navigateur === "embarque_facebook" || navigateur === "embarque_instagram" || navigateur === "embarque_tiktok";
}
