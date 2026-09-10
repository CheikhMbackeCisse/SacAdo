import { getRecapComptabilite, listerDepenses, type Periode } from "@/lib/admin/comptabilite-actions";
import { ComptabiliteEditor } from "@/components/admin/comptabilite-editor";
import { ComptabiliteTabs } from "@/components/admin/comptabilite-tabs";

export const dynamic = "force-dynamic";

const PERIODES_VALIDES: Periode[] = ["jour", "semaine", "mois"];

export default async function AdminComptabilitePage(props: PageProps<"/admin/comptabilite">) {
  const { periode: periodeBrute } = await props.searchParams;
  const periode = PERIODES_VALIDES.includes(periodeBrute as Periode) ? (periodeBrute as Periode) : "mois";

  const [recap, depenses] = await Promise.all([getRecapComptabilite(periode), listerDepenses()]);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Comptabilité</h1>
        <p className="mt-1 text-sm text-ink/55">
          Suivi de trésorerie simple pour piloter — pas une comptabilité légale.
        </p>
      </div>
      <ComptabiliteTabs actif="tresorerie" />
      <ComptabiliteEditor recap={recap} depenses={depenses} />
    </div>
  );
}
