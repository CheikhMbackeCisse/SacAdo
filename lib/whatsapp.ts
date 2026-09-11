// Configuration WhatsApp de SacAdo. Source unique du numéro : la variable
// d'environnement NEXT_PUBLIC_WHATSAPP_SACADO, avec repli sur le numéro
// historique pour ne jamais casser les liens si la variable manque.
// Aucun composant ne doit construire une adresse wa.me par lui-même
// (TACHE_whatsapp_admin.md §2).

const NUMERO_DEFAUT = "221703202150";

// Numéro au format wa.me : indicatif + numéro, chiffres seuls (sans +, sans espace).
export const WHATSAPP_NUMERO: string =
  (process.env.NEXT_PUBLIC_WHATSAPP_SACADO ?? "").replace(/\D/g, "") || NUMERO_DEFAUT;

// Version lisible pour l'affichage ("70 320 21 50").
export const WHATSAPP_AFFICHE: string = afficherTelephoneSN(WHATSAPP_NUMERO) ?? "70 320 21 50";

// Préfixes mobiles sénégalais valides (TACHE_whatsapp_admin.md §3).
const PREFIXES_MOBILES_SN = ["70", "75", "76", "77", "78"] as const;

// Normalise un numéro saisi par un client vers le format international attendu
// par wa.me : `221XXXXXXXXX` (12 chiffres), sans +, sans espace, sans tiret.
// Renvoie null si le numéro est structurellement inexploitable.
// Les règles suivent TACHE_whatsapp_admin.md §3 à la lettre.
export function normaliserTelephoneSN(saisi: string | null | undefined): string | null {
  // 1. Ne garder que les chiffres.
  let n = String(saisi ?? "").replace(/\D/g, "");
  if (!n) return null;

  // 2. `00221…` -> `221…`.
  if (n.startsWith("00221")) n = n.slice(2);

  // 3. `221` + 12 chiffres : déjà au bon format. Le doute éventuel sur le
  //    préfixe mobile est traité à part (estNumeroMobileSN), sans invalider.
  if (n.startsWith("221") && n.length === 12) {
    return n;
  }
  // 4. 9 chiffres commençant par 7.
  if (n.length === 9 && n.startsWith("7")) {
    return `221${n}`;
  }
  // 5. 10 chiffres commençant par `07`.
  if (n.length === 10 && n.startsWith("07")) {
    return `221${n.slice(1)}`;
  }
  // 6. Tout autre cas : invalide.
  return null;
}

// Un numéro normalisé correspond-il à un mobile sénégalais connu ? Un numéro
// bien formé mais avec un préfixe inconnu est « douteux » : on l'affiche avec un
// signalement, sans bloquer la commande (TACHE_whatsapp_admin.md §3).
export function estNumeroMobileSN(normalise: string | null | undefined): boolean {
  const n = String(normalise ?? "");
  if (n.length !== 12 || !n.startsWith("221")) return false;
  return respecteMobile(n);
}

function respecteMobile(normalise12: string): boolean {
  const local = normalise12.slice(3, 5);
  return (PREFIXES_MOBILES_SN as readonly string[]).includes(local);
}

// `221703202150` -> `70 320 21 50`. Renvoie null si l'entrée n'est pas un
// numéro sénégalais normalisé.
export function afficherTelephoneSN(normalise: string | null | undefined): string | null {
  const n = String(normalise ?? "").replace(/\D/g, "");
  if (n.length !== 12 || !n.startsWith("221")) return null;
  const l = n.slice(3);
  return `${l.slice(0, 2)} ${l.slice(2, 5)} ${l.slice(5, 7)} ${l.slice(7, 9)}`;
}

// Lien vers le numéro d'assistance SacAdo, message prérempli.
export function lienWhatsApp(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(message)}`;
}

// Lien vers un numéro arbitraire (ex : rappeler un client depuis l'admin).
// Renvoie null si le numéro est inexploitable — l'appelant masque alors le
// bouton WhatsApp (TACHE_whatsapp_admin.md §11).
export function lienWhatsAppVers(numero: string, message: string): string | null {
  const n = normaliserTelephoneSN(numero);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

// ---------------------------------------------------------------------------
// Messages préremplis côté client (TACHE_whatsapp_admin.md §8). Un seul
// endroit pour ces textes : aucun composant ne doit écrire son propre message.
// ---------------------------------------------------------------------------

export function lienAssistance(): string {
  return lienWhatsApp("Bonjour SacAdo, j'ai besoin d'aide : ");
}

export function lienAssistanceCommande(numeroCommande: number | string): string {
  return lienWhatsApp(`Bonjour, j'ai une question sur ma commande n°${numeroCommande}.`);
}

export function lienRechercheSansResultat(terme: string): string {
  return lienWhatsApp(`Bonjour, j'ai cherché "${terme}" sur SacAdo et je n'ai rien trouvé.`);
}

export function lienLocaliteLivraison(texte: string): string {
  return lienWhatsApp(`Bonjour SacAdo, je voudrais être livré à : ${texte}`);
}
