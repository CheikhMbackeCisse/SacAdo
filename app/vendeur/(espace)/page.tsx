import Link from "next/link";
import { ArrowRight, Package, TrendingUp } from "lucide-react";
import { getMesProduits } from "@/lib/vendeur/produits-actions";
import { getMesVentes } from "@/lib/vendeur/ventes-actions";
import { formatPrice } from "@/lib/format";

export default async function VendeurDashboardPage() {
  const [produits, ventes] = await Promise.all([getMesProduits(), getMesVentes()]);

  const enAttente = produits.filter((p) => p.statut_publication === "en_attente").length;
  const enNegociation = produits.filter((p) => p.statut_publication === "negociation").length;
  const publies = produits.filter((p) => p.statut_publication === "publie").length;
  const refuses = produits.filter((p) => p.statut_publication === "refuse").length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-bold text-[#001314]">Tableau de bord</h1>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Carte titre="Produits publiés" valeur={String(publies)} />
        <Carte titre="En attente de validation" valeur={String(enAttente)} accent={enAttente > 0} />
        <Carte titre="Négociation en cours" valeur={String(enNegociation)} accent={enNegociation > 0} />
        <Carte titre="Refusés" valeur={String(refuses)} danger={refuses > 0} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#001314]/10 bg-white p-4">
          <p className="text-xs font-medium text-[#001314]/50">Articles vendus (total)</p>
          <p className="mt-1 font-heading text-2xl font-bold text-[#001314]">{ventes.totalQuantite}</p>
        </div>
        <div className="rounded-2xl border border-[#001314]/10 bg-white p-4">
          <p className="text-xs font-medium text-[#001314]/50">Montant des ventes (brut)</p>
          <p className="mt-1 font-heading text-2xl font-bold text-[#001314]">
            {formatPrice(ventes.totalMontant)}
          </p>
          <p className="mt-1 text-[11px] text-[#001314]/45">
            Commission SacAdo et reversement affichés prochainement.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Raccourci
          href="/vendeur/produits"
          icon={Package}
          titre="Gérer mes produits"
          texte="Ajouter, modifier, suivre la validation, mettre à jour le stock."
        />
        <Raccourci
          href="/vendeur/ventes"
          icon={TrendingUp}
          titre="Voir mes ventes"
          texte="Le détail des articles vendus et des montants."
        />
      </div>
    </div>
  );
}

function Carte({
  titre,
  valeur,
  accent,
  danger,
}: {
  titre: string;
  valeur: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[#001314]/10 bg-white p-4">
      <p className="text-xs font-medium text-[#001314]/50">{titre}</p>
      <p
        className={`mt-1 font-heading text-2xl font-bold ${
          danger ? "text-red-600" : accent ? "text-[#8a4a1f]" : "text-[#001314]"
        }`}
      >
        {valeur}
      </p>
    </div>
  );
}

function Raccourci({
  href,
  icon: Icon,
  titre,
  texte,
}: {
  href: string;
  icon: typeof Package;
  titre: string;
  texte: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-[#001314]/10 bg-white p-4 transition-colors hover:border-[#0B3D91]/40"
    >
      <Icon size={20} className="mt-0.5 text-[#0B3D91]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 font-semibold text-[#001314]">
          {titre}
          <ArrowRight
            size={15}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
        <span className="mt-0.5 block text-xs text-[#001314]/55">{texte}</span>
      </span>
    </Link>
  );
}
