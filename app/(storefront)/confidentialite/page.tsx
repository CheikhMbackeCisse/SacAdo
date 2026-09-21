export const metadata = { title: "Politique de confidentialité — SacAdo" };

export default function ConfidentialitePage() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Politique de confidentialité</h1>
        <p className="mt-1 text-xs text-ink/50">Dernière mise à jour : 2026.</p>
      </div>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Ce que nous collectons</h2>
        <p className="text-sm text-ink/70">
          Ton nom, ton numéro de téléphone, ton adresse de livraison, l&apos;historique de tes
          commandes, et des données de navigation (rayons et produits consultés, recherches,
          ajouts au panier). Nous ne demandons ni email, ni mot de passe. Un éventuel paiement en
          ligne passe par Wave — nous ne voyons ni ne conservons tes informations bancaires.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Pourquoi</h2>
        <p className="text-sm text-ink/70">
          Traiter et livrer tes commandes, assurer le suivi par WhatsApp, et personnaliser les
          recommandations affichées sur l&apos;accueil. Ton numéro de téléphone sert
          d&apos;identifiant pour retrouver tes commandes et tes messages, sans avoir à créer de
          compte. Ton nom et ton adresse servent à préparer et livrer ta commande.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Ce qui reste sur ton appareil</h2>
        <p className="text-sm text-ink/70">
          Tes favoris, les produits déjà consultés et le contenu de ton panier sont gardés
          uniquement sur ton téléphone/ordinateur (jamais envoyés à un serveur tant que tu n&apos;as
          pas validé une commande). Effacer les données de ton navigateur les efface aussi.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Suivi de navigation et recommandations</h2>
        <p className="text-sm text-ink/70">
          Dès ta première visite, avant même que tu sois identifié, un identifiant de session
          anonyme est déposé dans un cookie. Il nous sert à retenir les rayons et les produits que
          tu consultes, ce que tu ajoutes au panier et ce que tu recherches, afin d&apos;adapter
          l&apos;ordre des produits sur l&apos;accueil à ce qui t&apos;intéresse. Ce suivi
          n&apos;est associé à aucune donnée personnelle tant que tu n&apos;as pas passé de
          commande ; à ce moment-là, ce qui a été appris est rattaché à ton numéro.
        </p>
        <p className="text-sm text-ink/70">
          Si tu enregistres un enfant, seuls son prénom et son niveau scolaire sont conservés —
          rien d&apos;autre à son sujet. Ses signaux de navigation sont suivis séparément pour lui
          proposer le bon matériel, jamais mélangés aux tiens.
        </p>
        <p className="text-sm text-ink/70">
          Tu peux tout effacer à tout moment depuis <span className="font-medium">Paramètres →
          Recommandations → « Réinitialiser mes recommandations »</span>.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Durées de conservation</h2>
        <p className="text-sm text-ink/70">
          Les données de navigation (session anonyme, produits consultés, recherches) sont
          automatiquement supprimées après 24 mois. Les données liées à une commande (nom,
          téléphone, adresse, historique) sont conservées tant que ton compte reste actif, ou
          jusqu&apos;à ta demande de suppression.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Qui y a accès</h2>
        <p className="text-sm text-ink/70">
          Seul l&apos;administrateur de SacAdo peut consulter tes informations, pour préparer et
          suivre tes commandes. Elles ne sont jamais vendues ni partagées avec un tiers.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Tes droits</h2>
        <p className="text-sm text-ink/70">
          Tu peux demander à tout moment l&apos;accès, la correction ou la suppression de tes
          données (nom, adresse, historique de commandes) en nous contactant via la page
          Assistance. Ce traitement est encadré par la loi n° 2008-12 du 25 janvier 2008 sur la
          protection des données à caractère personnel ; tu peux aussi t&apos;adresser à la
          Commission de protection des données personnelles (CDP) du Sénégal.
        </p>
      </section>
    </div>
  );
}
