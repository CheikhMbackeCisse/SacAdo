import Link from "next/link";
import { getArticlesParFournisseur } from "@/lib/admin/achats-actions";
import { AchatsVue } from "@/components/admin/achats-vue";

export const dynamic = "force-dynamic";

export default async function AdminAchatsPage(props: {
  searchParams: Promise<{ enAttente?: string }>;
}) {
  const { enAttente } = await props.searchParams;
  const inclureEnAttente = enAttente === "1";

  const { fournisseurs, stockSacAdo } = await getArticlesParFournisseur({ inclureEnAttente });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-ink">Fournisseurs</h1>
          <p className="mt-1 text-sm text-ink/55">
            Articles à commander chez chaque fournisseur, triés par urgence de livraison.
          </p>
        </div>
        <Link
          href="/admin/fournisseurs"
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70"
        >
          Fiches fournisseurs
        </Link>
      </div>
      <AchatsVue fournisseurs={fournisseurs} stockSacAdo={stockSacAdo} inclureEnAttente={inclureEnAttente} />
    </div>
  );
}
