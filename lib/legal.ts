// Identité légale de l'éditeur de SacAdo (TACHE_pages_legales_wave.md). Ne
// jamais dupliquer ces valeurs ailleurs : toutes les pages/mentions les
// importent d'ici, y compris la ligne « Bénéficiaire du paiement » avant
// Wave (§6) et le message WhatsApp de paiement reçu (migration 0084).
export const EDITEUR = {
  raisonSociale: "UNISHOP SENEGAL",
  formeJuridique: "Entreprise individuelle",
  ninea: "013237343",
  rccm: "SN DKR 2026 A 27798",
  localisation: "Dakar, Sénégal",
  telephone: "+221 77 779 35 22",
  email: "contact@sacado.sn",
} as const;

// Formule imposée (§1) : jamais « développé par » — l'éditeur est le
// responsable juridique et l'encaisseur des paiements, pas l'auteur du code.
export const MENTION_EDITEUR = `SacAdo est un service édité et exploité par ${EDITEUR.raisonSociale}.`;

// Affichée avant toute redirection Wave, dans le récapitulatif de commande et
// dans le message WhatsApp de paiement reçu (§6) — une seule formulation.
export const MENTION_BENEFICIAIRE_WAVE = `Bénéficiaire du paiement : ${EDITEUR.raisonSociale}`;

export const LIENS_LEGAUX = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/cgv", label: "CGV" },
  { href: "/retours", label: "Retours" },
  { href: "/confidentialite", label: "Confidentialité" },
] as const;
