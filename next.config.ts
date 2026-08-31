import type { NextConfig } from "next";

// Hôte du projet Supabase (Storage sert les photos uploadées par les vendeurs).
const SUPABASE_HOST = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

// CSP "raisonnable" : bloque les scripts/styles/images/connexions venant d'un
// domaine tiers non listé (protège contre l'injection de scripts malveillants
// même si une faille XSS apparaissait ailleurs). 'unsafe-inline' reste
// nécessaire pour les scripts d'hydratation de Next.js sans mise en place de
// nonces (plus complexe) ; le vrai rempart anti-XSS reste React (échappement
// automatique, aucun dangerouslySetInnerHTML dans le projet).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    // AVIF avant WebP : Next choisit le plus léger que le navigateur supporte.
    formats: ["image/avif", "image/webp"],
    // Photos produits des vendeurs, stockées dans Supabase Storage (bucket public).
    remotePatterns: SUPABASE_HOST
      ? [{ protocol: "https", hostname: SUPABASE_HOST, pathname: "/storage/v1/object/public/**" }]
      : [],
    // 1 an : les photos produits/catégories changent rarement, inutile de
    // les redemander/reconvertir toutes les 60s (défaut Next).
    minimumCacheTTL: 31536000,
  },
  experimental: {
    // Garde les segments déjà visités en cache côté client plus longtemps
    // (par défaut quasi nul en Next 15+) : revenir sur un onglet de la bottom
    // nav déjà vu réutilise le rendu au lieu de refaire une requête RSC.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          // Anti-clickjacking : personne ne peut mettre SacAdo dans une <iframe>.
          { key: "X-Frame-Options", value: "DENY" },
          // Empêche le navigateur de "deviner" le type d'un fichier (ex: un
          // fichier renommé .jpg mais exécuté comme script).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // N'envoie l'URL complète comme referrer qu'aux sites en https, et
          // seulement le domaine (pas le chemin complet) vers un autre site.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Coupe l'accès à des capteurs qu'on n'utilise jamais.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
