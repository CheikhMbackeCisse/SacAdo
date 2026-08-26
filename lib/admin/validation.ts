// Petits garde-fous partagés par les Server Actions admin : l'admin est une
// seule personne de confiance, mais une saisie accidentelle (champ vide,
// virgule au lieu d'un point...) ne doit pas atteindre la base sous forme de
// NaN ou de nombre négatif.
export function estNombrePositifValide(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export function texteNonVide(s: unknown, maxLength = 200): s is string {
  return typeof s === "string" && s.trim().length > 0 && s.length <= maxLength;
}
