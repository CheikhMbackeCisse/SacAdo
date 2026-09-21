import Link from "next/link";
import { EDITEUR } from "@/lib/legal";

export const metadata = { title: "Mentions légales — SacAdo" };

export default function MentionsLegalesPage() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Mentions légales</h1>
        <p className="mt-1 text-xs text-ink/50">Dernière mise à jour : 2026.</p>
      </div>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Éditeur du service</h2>
        <p className="text-sm text-ink/70">
          SacAdo est un service édité et exploité par {EDITEUR.raisonSociale}.
        </p>
        <ul className="mt-1 flex flex-col gap-0.5 text-sm text-ink/70">
          <li>Dénomination : {EDITEUR.raisonSociale}</li>
          <li>Forme juridique : {EDITEUR.formeJuridique}</li>
          <li>NINEA : {EDITEUR.ninea}</li>
          <li>RCCM : {EDITEUR.rccm}</li>
          <li>Localisation : {EDITEUR.localisation}</li>
          <li>Téléphone : {EDITEUR.telephone}</li>
          <li>E-mail : {EDITEUR.email}</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Paiement</h2>
        <p className="text-sm text-ink/70">
          Les paiements en ligne sont traités par Wave. Sur l&apos;écran de paiement, le
          bénéficiaire affiché est {EDITEUR.raisonSociale}, éditeur de SacAdo.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Propriété intellectuelle</h2>
        <p className="text-sm text-ink/70">
          La marque SacAdo, son logo, la structure et les contenus de l&apos;application sont la
          propriété de {EDITEUR.raisonSociale}. Les marques et visuels des produits vendus
          appartiennent à leurs titulaires respectifs.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Données personnelles</h2>
        <p className="text-sm text-ink/70">
          Le traitement des données personnelles est encadré par la loi n° 2008-12 du 25 janvier
          2008 sur la protection des données à caractère personnel. Les modalités sont détaillées
          dans la{" "}
          <Link href="/confidentialite" className="font-medium text-brand">
            politique de confidentialité
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
