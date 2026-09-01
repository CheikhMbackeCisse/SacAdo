const FAQ = [
  {
    q: "Comment suivre ma commande ?",
    r: "Ouvre \"Mes commandes\" dans l'espace Moi, ou le lien reçu juste après avoir commandé.",
  },
  {
    q: "Quels sont les délais de livraison ?",
    r: "24h ou 6 jours selon le produit et ta zone — c'est indiqué sur chaque article.",
  },
  {
    q: "Comment payer ?",
    r: "Uniquement à la livraison : espèces, Wave ou Orange Money directement auprès du livreur.",
  },
  {
    q: "Puis-je changer d'adresse après avoir commandé ?",
    r: "Contacte-nous directement, voir les coordonnées ci-dessous.",
  },
];

export default function AssistancePage() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-5 px-4 py-4">
      <h1 className="font-heading text-xl font-bold text-ink">Assistance</h1>

      <section className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated">
        {FAQ.map((item) => (
          <details key={item.q} className="px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink marker:text-ink/40">
              {item.q}
            </summary>
            <p className="pt-2 text-xs text-ink/60">{item.r}</p>
          </details>
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <span className="text-xs font-medium text-ink/60">Nous contacter</span>
        <p className="text-sm text-ink">WhatsApp : 77 000 00 00</p>
        <p className="text-sm text-ink">Email : contact@sacado.sn</p>
      </section>
    </div>
  );
}
