import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getArticlesParFournisseur } from "@/lib/admin/achats-actions";
import { ProduitsCommandeVue } from "@/components/admin/produits-commande-vue";

export const dynamic = "force-dynamic";

export default async function AdminCommandesProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const commandeIds = (typeof ids === "string" ? ids : "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const { fournisseurs, stockSacAdo, tousLesArticles } = await getArticlesParFournisseur({ commandeIds });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/admin/commandes"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink/50 hover:text-brand"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Commandes
        </Link>
        <h1 className="font-heading text-xl font-bold text-ink">
          Produits — commande{commandeIds.length > 1 ? "s" : ""} {commandeIds.map((id) => `#${id}`).join(", ")}
        </h1>
      </div>

      {commandeIds.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucune commande sélectionnée.
        </p>
      ) : (
        <ProduitsCommandeVue tousLesArticles={tousLesArticles} fournisseurs={fournisseurs} stockSacAdo={stockSacAdo} />
      )}
    </div>
  );
}
