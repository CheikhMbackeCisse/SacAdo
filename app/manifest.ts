import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SacAdo — Fournitures scolaires",
    short_name: "SacAdo",
    description:
      "Kits scolaires et fournitures d'étude, livrés partout au Sénégal.",
    start_url: "/",
    display: "standalone",
    // Fond du splash natif : blanc de la marque, pour se fondre avec la nouvelle
    // icône (cartable bleu sur fond blanc). Le manifeste ne permet pas de valeur
    // par thème ; l'écran de démarrage de l'app (SplashScreen) prend le relais
    // aussitôt et s'adapte clair/sombre.
    background_color: "#FEFDFF",
    theme_color: "#0B3D91",
    lang: "fr",
    icons: [
      { src: "/icons/client-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/client-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Cartable recentré avec marge blanche : Android découpe selon la forme du système.
      { src: "/icons/client-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
