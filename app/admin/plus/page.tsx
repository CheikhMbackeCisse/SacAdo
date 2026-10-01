import Link from "next/link";
import { LIENS } from "@/lib/admin/nav-liens";
import { RechercheAllerA } from "@/components/admin/recherche-aller-a";
import { ActiverPushAdmin } from "@/components/admin/activer-push-admin";
import { DeconnexionAdmin } from "@/components/admin/deconnexion-admin";

// Page "Plus" (PROMPT_ADMIN Lot 2) : tous les onglets admin qui ne sont pas
// dans la bottom nav (Accueil, Commandes, Livraison, Produits, Kits),
// regroupés par thème pour s'y retrouver vite sur téléphone.
const GROUPES = [
  {
    titre: "Boutique",
    hrefs: [
      "/admin/categories",
      "/admin/attributs",
      "/admin/synonymes",
      "/admin/classement",
      "/admin/recherches",
      "/admin/classes",
      "/admin/ebooks",
      "/admin/documents",
    ],
  },
  { titre: "Clients", hrefs: ["/admin/clients", "/admin/modeles", "/admin/notifications"] },
  { titre: "Livraison et paiement", hrefs: ["/admin/zones", "/admin/localites", "/admin/lieux-speciaux"] },
  { titre: "Partenaires", hrefs: ["/admin/fournisseurs", "/admin/moderation", "/admin/preparations"] },
  { titre: "Suivi", hrefs: ["/admin/ventes", "/admin/editions", "/admin/prix-a-verifier", "/admin/comptabilite"] },
] as const;

export default function AdminPlusPage() {
  const parHref = new Map(LIENS.map((l) => [l.href, l]));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-bold text-ink">Plus</h1>

      <RechercheAllerA liens={LIENS.map(({ href, label }) => ({ href, label }))} />

      {GROUPES.map((groupe) => (
        <section key={groupe.titre}>
          <h2 className="mb-2 text-sm font-semibold text-ink/60">{groupe.titre}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {groupe.hrefs.map((href) => {
              const lien = parHref.get(href);
              if (!lien) return null;
              const Icon = lien.icon;
              return (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-start gap-2 rounded-2xl border border-ink/10 bg-white p-4 text-sm text-ink transition-colors hover:border-brand/40"
                >
                  <Icon size={18} className="text-brand" aria-hidden="true" />
                  {lien.label}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink/60">Compte</h2>
        <div className="flex flex-col gap-3">
          <ActiverPushAdmin />
          <DeconnexionAdmin />
        </div>
      </section>
    </div>
  );
}
