import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SacAdo — Fournitures scolaires",
    short_name: "SacAdo",
    description:
      "Kits scolaires et fournitures d'étude, livrés partout au Sénégal.",
    start_url: "/",
    display: "standalone",
    background_color: "#FEFDFF",
    theme_color: "#0B3D91",
    lang: "fr",
    icons: [
      {
        src: "/images/logo.jpg",
        sizes: "192x192",
        type: "image/jpeg",
      },
      {
        src: "/images/logo.jpg",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ],
  };
}
