// Classification source / appareil / navigateur pour la mesure de
// fréquentation (PROMPT_CLIENT_V2 Lot 5). Pur, testable — aucun accès DOM ni
// réseau, pour pouvoir être vérifié sans mocks.

export type SourceType =
  | "google_recherche"
  | "google_pub"
  | "affiche"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "autre_site"
  | "direct";

export type Appareil = "android" | "iphone" | "ordinateur" | "autre";

// Marqueurs de navigateur embarqué (webview d'une app) : le referrer est
// souvent vide dans ce contexte, ce signal UA est alors le seul disponible.
function sourceDepuisWebviewEmbarque(userAgent: string): SourceType | null {
  if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return "facebook";
  if (/Instagram/i.test(userAgent)) return "instagram";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(userAgent)) return "tiktok";
  return null;
}

function sourceDepuisHote(hote: string): SourceType | null {
  const h = hote.toLowerCase();
  if (h.includes("google.")) return "google_recherche";
  if (h.includes("facebook.com") || h === "fb.com" || h.includes("l.facebook.com")) return "facebook";
  if (h.includes("instagram.com")) return "instagram";
  if (h.includes("tiktok.com")) return "tiktok";
  if (h.includes("whatsapp.com") || h === "wa.me") return "whatsapp";
  return null;
}

// `utmSource` vient soit d'un lien suivi créé dans l'admin (reconnu en base),
// soit d'un paramètre `utm_source` saisi librement dans une URL — on retombe
// alors sur des mots-clés usuels pour le classer correctement.
function sourceDepuisUtm(utmSource: string): SourceType | null {
  const s = utmSource.toLowerCase();
  if (s.includes("affiche") || s.includes("qr") || s.includes("flyer")) return "affiche";
  if (s.includes("whatsapp")) return "whatsapp";
  if (s.includes("facebook") || s === "fb") return "facebook";
  if (s.includes("instagram") || s === "ig") return "instagram";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("google")) return "google_recherche";
  return "autre_site";
}

export function determinerSource(input: {
  utmSource?: string | null;
  gclid?: string | null;
  referentHote?: string | null;
  siteHote: string;
  userAgent: string;
}): SourceType {
  if (input.gclid) return "google_pub";
  if (input.utmSource) return sourceDepuisUtm(input.utmSource) ?? "autre_site";

  const viaWebview = sourceDepuisWebviewEmbarque(input.userAgent);
  if (viaWebview) return viaWebview;

  if (input.referentHote && input.referentHote.toLowerCase() !== input.siteHote.toLowerCase()) {
    return sourceDepuisHote(input.referentHote) ?? "autre_site";
  }

  return "direct";
}

export function determinerAppareil(userAgent: string): Appareil {
  const ua = userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "iphone";
  if (/mobile/.test(ua)) return "autre";
  if (/windows|macintosh|linux/.test(ua) && !/mobile/.test(ua)) return "ordinateur";
  return "autre";
}

export function determinerNavigateur(userAgent: string): string {
  if (/FBAN|FBAV|FB_IAB/.test(userAgent)) return "Facebook (intégré)";
  if (/Instagram/i.test(userAgent)) return "Instagram (intégré)";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(userAgent)) return "TikTok (intégré)";
  if (/SamsungBrowser/i.test(userAgent)) return "Samsung Internet";
  if (/EdgA\/|Edg\//i.test(userAgent)) return "Edge";
  if (/OPR\/|Opera/i.test(userAgent)) return "Opera";
  if (/FxiOS|Firefox/i.test(userAgent)) return "Firefox";
  if (/CriOS|Chrome/i.test(userAgent)) return "Chrome";
  if (/Safari/i.test(userAgent)) return "Safari";
  return "Autre";
}

// Hôte depuis une URL de referrer, sans jeter si elle est malformée.
export function hoteDepuisUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
