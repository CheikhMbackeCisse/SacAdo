// SacAdo — maj-accueil §7 : la « livraison 6 jours » devient « livraison à une
// date donnée ». Fonction pure (testable) qui calcule cette date à partir de
// l'instant de la commande (fuseau Africa/Dakar), d'une heure limite du samedi
// facultative et d'une liste de dates fermées.
//
// Règle :
//   - commande du lundi au samedi (avant l'heure limite) -> dimanche qui suit ;
//   - commande du samedi après l'heure limite -> passe au samedi suivant ;
//   - commande du dimanche -> samedi qui suit.
// Si la date obtenue est fermée, on avance jour par jour jusqu'à la prochaine
// date ouverte qui soit un samedi ou un dimanche.

const FUSEAU = "Africa/Dakar";

function partiesDakar(date: Date): { annee: number; mois: number; jour: number; heure: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const val = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { annee: val("year"), mois: val("month"), jour: val("day"), heure: val("hour"), minute: val("minute") };
}

// Toutes les dates sont manipulées à midi UTC pour éviter tout glissement de
// jour lié à l'heure — Dakar n'observe aucun décalage (UTC+0 à l'année), donc
// une date calendaire y correspond exactement à la même date UTC.
function dateUTCMidi(annee: number, mois: number, jour: number): Date {
  return new Date(Date.UTC(annee, mois - 1, jour, 12));
}

function isoJour(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function ajouterJours(date: Date, n: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

// "HH:MM" -> minutes depuis minuit ; null/vide = aucune heure limite.
function minutesDepuisMinuit(heure: string | null | undefined): number | null {
  if (!heure) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(heure.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function calculerDateLivraison(
  maintenant: Date,
  heureLimiteSamedi: string | null | undefined,
  datesFermees: readonly string[],
): string {
  const { annee, mois, jour, heure, minute } = partiesDakar(maintenant);
  const aujourdhui = dateUTCMidi(annee, mois, jour);
  const jourSemaine = aujourdhui.getUTCDay(); // 0 = dimanche, 6 = samedi

  let candidate: Date;
  if (jourSemaine === 0) {
    // Dimanche -> le samedi qui suit (6 jours).
    candidate = ajouterJours(aujourdhui, 6);
  } else if (jourSemaine === 6) {
    const limite = minutesDepuisMinuit(heureLimiteSamedi);
    const passeLaLimite = limite != null && heure * 60 + minute > limite;
    // Trop tard pour préparer la livraison de dimanche -> passe au samedi suivant.
    candidate = ajouterJours(aujourdhui, passeLaLimite ? 7 : 1);
  } else {
    // Lundi (1) à vendredi (5) -> le dimanche qui suit.
    candidate = ajouterJours(aujourdhui, 7 - jourSemaine);
  }

  const fermees = new Set(datesFermees);
  while (fermees.has(isoJour(candidate)) || (candidate.getUTCDay() !== 0 && candidate.getUTCDay() !== 6)) {
    candidate = ajouterJours(candidate, 1);
  }
  return isoJour(candidate);
}
