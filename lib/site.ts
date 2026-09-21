// Source unique pour l'adresse publique du site quand elle doit être connue
// de façon statique (métadonnées, sitemap, robots.txt) — pas de requête
// entrante disponible à ce moment. Pour un lien absolu construit pendant le
// traitement d'une requête serveur (Server Action, Route Handler), utiliser
// plutôt origineSite() de lib/site-url.ts, qui peut retomber sur l'en-tête
// `host` si la variable d'environnement est absente.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sacado.sn").replace(/\/$/, "");
