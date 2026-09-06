import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDemandePreparation } from "@/lib/admin/preparations-actions";
import { refPreparation, formatDateHeureDakar, numeroWhatsapp } from "@/lib/preparations";
import { jetonPreparation } from "@/lib/preparation-auth";
import { origineSite } from "@/lib/site-url";
import { BonPreparation } from "@/components/admin/bon-preparation";
import { LienFournisseur } from "@/components/admin/lien-fournisseur";
import { PastilleDemande } from "@/components/admin/pastille-demande";
import { MarquerRecupereeBouton } from "@/components/admin/preparation-recuperee";

export const dynamic = "force-dynamic";

const formatDateHeure = formatDateHeureDakar;

export default async function AdminPreparationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const demande = await getDemandePreparation(Number(id));
  if (!demande) notFound();

  const lien = `${await origineSite()}/preparation/${demande.id}?t=${jetonPreparation(demande.id)}`;
  const messageWa = `Bonjour, une préparation vous attend sur SacAdo (${refPreparation(
    demande.id,
  )}). Détails et validation ici : ${lien}`;
  const numero = numeroWhatsapp(demande.vendeurTelephone);
  const urlWhatsapp = `https://wa.me/${numero ?? ""}?text=${encodeURIComponent(messageWa)}`;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <Link
          href="/admin/preparations"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink/50 hover:text-brand"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Préparations
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-xl font-bold text-ink">{refPreparation(demande.id)}</h1>
          <PastilleDemande statut={demande.statut} recupereeLe={demande.recupereeLe} />
        </div>
        <p className="mt-1 text-sm text-ink/55">
          Fournisseur : <span className="font-medium text-ink/80">{demande.vendeurNom}</span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl border border-ink/10 bg-white p-4 text-sm">
        <div>
          <dt className="text-xs text-ink/50">Créée le</dt>
          <dd className="text-ink">{formatDateHeure(demande.creeLe)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink/50">Déclenchement</dt>
          <dd className="text-ink">{demande.declenchement === "auto_24h" ? "Automatique (24h)" : "Manuel"}</dd>
        </div>
        {demande.prepareeLe && (
          <div>
            <dt className="text-xs text-ink/50">Préparée le</dt>
            <dd className="text-ink">{formatDateHeure(demande.prepareeLe)}</dd>
          </div>
        )}
        {demande.recupereeLe && (
          <div>
            <dt className="text-xs text-ink/50">Récupérée le</dt>
            <dd className="text-ink">{formatDateHeure(demande.recupereeLe)}</dd>
          </div>
        )}
        {demande.note && (
          <div className="col-span-2">
            <dt className="text-xs text-ink/50">Note</dt>
            <dd className="text-ink">{demande.note}</dd>
          </div>
        )}
      </dl>

      <LienFournisseur lien={lien} urlWhatsapp={urlWhatsapp} />

      {demande.statut === "preparee" && (
        <MarquerRecupereeBouton id={demande.id} recupereeLe={demande.recupereeLe} />
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/40">
          Ce que le fournisseur voit
        </p>
        <BonPreparation
          groupes={demande.groupes}
          totaux={demande.totaux}
          nbArticles={demande.nbArticles}
        />
      </div>
    </div>
  );
}
