import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMaPreparation } from "@/lib/vendeur/preparations-actions";
import { refPreparation } from "@/lib/preparations";
import { BonPreparation } from "@/components/admin/bon-preparation";
import { EnteteDocument } from "@/components/preparation/entete-document";
import { ConfirmerMaPreparation } from "@/components/vendeur/confirmer-ma-preparation";

export const dynamic = "force-dynamic";

export default async function VendeurPreparationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bon = await getMaPreparation(Number(id));
  if (!bon) notFound();

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/vendeur/preparations"
        className="inline-flex items-center gap-1 text-xs font-medium text-[#001314]/50 hover:text-[#0B3D91]"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        Préparations
      </Link>

      <EnteteDocument demandeId={bon.id} creeLe={bon.creeLe} />

      {bon.note && (
        <p className="rounded-lg bg-[#0B3D91]/5 px-3 py-2 text-sm text-[#001314]/75">
          <span className="font-medium text-[#001314]">Note : </span>
          {bon.note}
        </p>
      )}

      <BonPreparation groupes={bon.groupes} totaux={bon.totaux} nbArticles={bon.nbArticles} />

      <ConfirmerMaPreparation id={bon.id} statut={bon.statut} prepareeLe={bon.prepareeLe} />

      <p className="text-center text-[11px] text-[#001314]/35">
        {refPreparation(bon.id)} · document SacAdo
      </p>
    </div>
  );
}
