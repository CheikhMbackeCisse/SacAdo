// Numéro d'assistance SacAdo au format wa.me (indicatif + numéro, sans + ni espaces).
export const WHATSAPP_NUMERO = "221703202150";
export const WHATSAPP_AFFICHE = "70 320 21 50";

export function lienWhatsApp(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(message)}`;
}
