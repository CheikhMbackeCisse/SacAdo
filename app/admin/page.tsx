import Link from "next/link";
import { AlertTriangle, ClipboardList, Package, PackageCheck, TrendingUp, Wallet } from "lucide-react";
import { getDashboardStats } from "@/lib/admin/reporting-actions";
import { formatPrice } from "@/lib/format";
import { StatCard } from "@/components/admin/stat-card";
import { InstallCard } from "@/components/pwa/install-card";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-bold text-ink">Tableau de bord</h1>

      <div className="lg:max-w-md">
        <InstallCard appName="SacAdo Admin" />
      </div>

      {stats.preparationsPretes > 0 && (
        <Link
          href="/admin/preparations"
          className="flex items-center gap-3 rounded-2xl border border-brand/25 bg-brand/[0.04] p-4 transition-colors hover:border-brand/50"
        >
          <PackageCheck size={20} className="shrink-0 text-brand" aria-hidden="true" />
          <span className="text-sm text-ink">
            <span className="font-semibold">
              {stats.preparationsPretes} préparation{stats.preparationsPretes > 1 ? "s" : ""} prête
              {stats.preparationsPretes > 1 ? "s" : ""}
            </span>{" "}
            chez un fournisseur — à récupérer.
          </span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Wallet} label="CA du jour" value={formatPrice(stats.caDuJour)} />
        <StatCard
          icon={ClipboardList}
          label="Commandes aujourd'hui"
          value={String(stats.nbCommandesDuJour)}
        />
        <StatCard icon={TrendingUp} label="Panier moyen (jour)" value={formatPrice(stats.panierMoyenDuJour)} />
        <StatCard
          icon={AlertTriangle}
          label="Alertes stock"
          value={String(stats.alertesStock.length)}
          warn={stats.alertesStock.length > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink/10 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-ink">Top produits vendus</h2>
          {stats.topProduits.length === 0 ? (
            <p className="text-sm text-ink/50">Aucune vente pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ink/10">
              {stats.topProduits.map((produit) => (
                <li key={produit.nom} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">{produit.nom}</span>
                  <span className="font-semibold text-ink/70">{produit.quantite}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Package size={16} aria-hidden="true" />
            Alertes stock bas
          </h2>
          {stats.alertesStock.length === 0 ? (
            <p className="text-sm text-ink/50">Tout va bien, aucun produit sous son seuil.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ink/10">
              {stats.alertesStock.map((produit) => (
                <li key={produit.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">{produit.nom}</span>
                  <span className="font-semibold text-red-600">
                    {produit.stock} / seuil {produit.seuil_alerte}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
