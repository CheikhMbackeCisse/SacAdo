import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SacAdo — Fournitures scolaires",
    short_name: "SacAdo",
    description:
      "Kits scolaires et fournitures d'étude, livrés partout au Sénégal.",
    start_url: "/",
    display: "standalone",
    // Fond du splash natif = bleu nuit du logo (PAS blanc) : au tout premier
    // instant, l'utilisateur voit le fond de marque avec l'icône centrée, pas
    // une page blanche. Doit rester cohérent avec le fond de SplashScreen.
    background_color: "#02296C",
    theme_color: "#0B3D91",
    lang: "fr",
    icons: [
      { src: "/images/logo.jpg", sizes: "192x192", type: "image/jpeg", purpose: "any" },
      { src: "/images/logo.jpg", sizes: "512x512", type: "image/jpeg", purpose: "any" },
      // Le logo a une marge suffisante autour du cartable : réutilisable en
      // maskable (Android découpe l'icône selon la forme du système).
      { src: "/images/logo.jpg", sizes: "512x512", type: "image/jpeg", purpose: "maskable" },
    ],
  };
}
