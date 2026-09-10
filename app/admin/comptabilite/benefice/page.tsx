import { getBenefice } from "@/lib/admin/comptabilite-actions";
import { resoudrePeriodeBenefice } from "@/lib/admin/comptabilite-constants";
import { ComptabiliteTabs } from "@/components/admin/comptabilite-tabs";
import { BeneficeSection } from "@/components/admin/benefice-section";

export const dynamic = "force-dynamic";

export default async function AdminBeneficePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const texte = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  const { type, debut, fin } = resoudrePeriodeBenefice(texte(sp.bp), texte(sp.bd), texte(sp.bf));
  const benefice = await getBenefice(debut, fin);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Comptabilité</h1>
        <p className="mt-1 text-sm text-ink/55">
          Bénéfice = encaissements réels − (dépenses + prix d&apos;achat des articles vendus).
        </p>
      </div>
      <ComptabiliteTabs actif="benefice" />
      <BeneficeSection benefice={benefice} periodeType={type} />
    </div>
  );
}
