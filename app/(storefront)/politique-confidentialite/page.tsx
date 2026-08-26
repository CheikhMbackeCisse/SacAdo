export default function PolitiqueConfidentialitePage() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Politique de confidentialité</h1>
        <p className="mt-1 text-xs text-ink/50">Dernière mise à jour : 2026.</p>
      </div>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Ce que nous collectons</h2>
        <p className="text-sm text-ink/70">
          Uniquement ce qui est nécessaire pour traiter une commande : ton nom, ton numéro de
          téléphone, ton adresse de livraison et l&apos;historique de tes commandes. Nous ne
          demandons ni email, ni mot de passe, ni moyen de paiement — le paiement se fait
          uniquement à la livraison.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Pourquoi</h2>
        <p className="text-sm text-ink/70">
          Ton numéro de téléphone sert d&apos;identifiant pour retrouver tes commandes et tes
          messages, sans avoir à créer de compte. Ton nom et ton adresse servent à préparer et
          livrer ta commande.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Ce qui reste sur ton appareil</h2>
        <p className="text-sm text-ink/70">
          Tes favoris, les produits déjà consultés et le contenu de ton panier sont gardés
          uniquement sur ton téléphone/ordinateur (jamais envoyés à un serveur tant que tu n&apos;as
          pas validé une commande). Effacer les données de ton navigateur les efface aussi.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Qui y a accès</h2>
        <p className="text-sm text-ink/70">
          Seul l&apos;administrateur de SacAdo peut consulter tes informations, pour préparer et
          suivre tes commandes. Elles ne sont jamais vendues ni partagées avec un tiers.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <h2 className="text-sm font-semibold text-ink">Tes droits</h2>
        <p className="text-sm text-ink/70">
          Tu peux demander à tout moment la suppression de tes données (nom, adresse, historique
          de commandes) en nous contactant via la page Assistance.
        </p>
      </section>
    </div>
  );
}
