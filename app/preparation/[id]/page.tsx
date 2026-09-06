import { notFound } from "next/navigation";
import { verifierJetonPreparation } from "@/lib/preparation-auth";
import { chargerBonPreparation } from "@/lib/preparation-bon";
import { BonPreparation } from "@/components/admin/bon-preparation";
import { EnteteDocument } from "@/components/preparation/entete-document";
import { ConfirmerPreparation } from "@/components/preparation/confirmer-preparation";

export const dynamic = "force-dynamic";

export default async function BonPreparationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  const demandeId = Number(id);
  if (!Number.isFinite(demandeId)) notFound();

  if (!verifierJetonPreparation(demandeId, typeof t === "string" ? t : "")) notFound();

  const bon = await chargerBonPreparation(demandeId);
  if (!bon) notFound();

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-6">
      <EnteteDocument demandeId={bon.id} creeLe={bon.creeLe} />

      <div>
        <p className="text-sm text-ink/60">
          Bonjour <span className="font-medium text-ink">{bon.vendeurNom}</span>, voici ce
          qu&apos;il faut préparer. Chaque section = un client (préparez un paquet par
          client).
        </p>
        {bon.note && (
          <p className="mt-2 rounded-lg bg-brand/5 px-3 py-2 text-sm text-ink/75">
            <span className="font-medium text-ink">Note : </span>
            {bon.note}
          </p>
        )}
      </div>

      <BonPreparation groupes={bon.groupes} totaux={bon.totaux} nbArticles={bon.nbArticles} />

      <ConfirmerPreparation
        demandeId={bon.id}
        jeton={typeof t === "string" ? t : ""}
        statut={bon.statut}
        prepareeLe={bon.prepareeLe}
      />

      <p className="text-center text-[11px] text-ink/35">
        Document SacAdo · {bon.vendeurNom} · à présenter à la récupération de la marchandise.
      </p>
    </main>
  );
}
