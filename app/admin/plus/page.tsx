import Link from "next/link";
import { LIENS } from "@/lib/admin/nav-liens";
import { RechercheAllerA } from "@/components/admin/recherche-aller-a";
import { ActiverPushAdmin } from "@/components/admin/activer-push-admin";
import { DeconnexionAdmin } from "@/components/admin/deconnexion-admin";

// Page "Plus" (PROMPT_ADMIN Lot 2, revue par PROMPT_ADMIN_V2 Lot 1) : tous
// les onglets admin qui ne sont pas dans la bottom nav (Accueil, Commandes,
// Kits, Trafic). Produits en première tuile (retiré de la bottom nav pour
// faire de la place à Trafic, reste accessible par la recherche "Aller à…"),
// puis le reste regroupé par thème.
const GROUPES = [
  {
    titre: "Boutique",
    hrefs: [
      "/admin/decouvrir",
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
  {
    titre: "Livraison et paiement",
    hrefs: ["/admin/livraisons", "/admin/zones", "/admin/localites", "/admin/localites/carte", "/admin/lieux-speciaux"],
  },
  { titre: "Partenaires", hrefs: ["/admin/achats", "/admin/fournisseurs", "/admin/moderation", "/admin/preparations"] },
  { titre: "Suivi", hrefs: ["/admin/ventes", "/admin/editions", "/admin/prix-a-verifier", "/admin/comptabilite"] },
] as const;

const PRODUITS = LIENS.find((l) => l.href === "/admin/produits")!;

export default function AdminPlusPage() {
  const parHref = new Map(LIENS.map((l) => [l.href, l]));
  const IconProduits = PRODUITS.icon;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-bold text-ink">Plus</h1>

      <RechercheAllerA liens={LIENS.map(({ href, label }) => ({ href, label }))} />

      <Link
        href={PRODUITS.href}
        className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-4 text-sm font-medium text-ink transition-colors hover:border-brand/40"
      >
        <IconProduits size={18} className="text-brand" aria-hidden="true" />
        {PRODUITS.label}
      </Link>

      {GROUPES.map((groupe) => (
        <section key={groupe.titre}>
          <h2 className="mb-2 text-sm font-semibold text-ink/60">{groupe.titre}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
