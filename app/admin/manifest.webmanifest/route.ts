// Manifeste de l'app d'ADMINISTRATION (TACHE_admin_pwa_meme_domaine.md).
// Servi depuis la même origine que l'espace client, mais avec un `id`, un
// `scope` et un `start_url` distincts : le navigateur l'installe comme une
// application séparée. `id` est le champ décisif — sans lui, Chrome considère
// que c'est la même app que l'espace client et refuse la seconde installation.

const MANIFESTE = {
  id: "/admin",
  name: "SacAdo Admin",
  short_name: "Admin",
  description: "Gestion SacAdo : commandes, stocks, préparations, reporting.",
  start_url: "/admin",
  scope: "/admin/",
  display: "standalone",
  orientation: "portrait",
  lang: "fr",
  background_color: "#031726",
  theme_color: "#031726",
  icons: [
    { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

// Contenu 100 % statique : pas besoin de le recalculer à chaque requête.
export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(MANIFESTE), {
    headers: {
      "Content-Type": "application/manifest+json",
      // Le manifeste change rarement ; on laisse un cache court côté navigateur.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
