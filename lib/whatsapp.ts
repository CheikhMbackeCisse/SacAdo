// Numéro d'assistance SacAdo au format wa.me (indicatif + numéro, sans + ni espaces).
export const WHATSAPP_NUMERO = "221703202150";
export const WHATSAPP_AFFICHE = "70 320 21 50";

export function lienWhatsApp(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(message)}`;
}

// Lien vers un numéro arbitraire (ex : rappeler un client depuis l'admin).
// Normalise le numéro sénégalais : garde les chiffres, ajoute l'indicatif 221
// si absent. Renvoie null si le numéro est inexploitable.
export function lienWhatsAppVers(numero: string, message: string): string | null {
  let chiffres = (numero ?? "").replace(/\D/g, "");
  if (chiffres.length < 6) return null;
  if (chiffres.startsWith("00")) chiffres = chiffres.slice(2);
  if (!chiffres.startsWith("221")) chiffres = `221${chiffres}`;
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`;
}
