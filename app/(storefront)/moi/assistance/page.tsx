import { Mail, MessageCircle } from "lucide-react";

// Numéro d'assistance (format wa.me : indicatif + numéro, sans + ni espaces).
const WHATSAPP_NUMERO = "221703202150";
const WHATSAPP_AFFICHE = "70 320 21 50";
const WHATSAPP_MESSAGE = "Bonjour SacAdo, j'ai besoin d'aide : ";
const EMAIL = "service-client@sacado.sn";

const lienWhatsApp = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

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
    r: "Le mode de paiement disponible s'affiche au moment de commander : à la livraison (espèces, Wave ou Orange Money auprès du livreur) et/ou paiement d'avance par Wave selon le montant.",
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

      <section className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-elevated p-4">
        <div>
          <span className="text-xs font-medium text-ink/60">Nous contacter</span>
          <p className="mt-0.5 text-sm text-ink/70">
            Une question ? Dites-nous en quoi SacAdo peut vous aider.
          </p>
        </div>

        <a
          href={lienWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-on-brand transition-transform active:scale-95"
        >
          <MessageCircle size={16} aria-hidden="true" />
          Écrire sur WhatsApp
        </a>

        <div className="flex flex-col gap-1.5 text-sm text-ink/75">
          <p className="flex items-center gap-2">
            <MessageCircle size={14} className="shrink-0 text-ink/40" aria-hidden="true" />
            WhatsApp : <span className="font-medium text-ink">{WHATSAPP_AFFICHE}</span>
          </p>
          <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 hover:underline">
            <Mail size={14} className="shrink-0 text-ink/40" aria-hidden="true" />
            {EMAIL}
          </a>
        </div>
      </section>
    </div>
  );
}
