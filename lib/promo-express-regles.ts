// Règles pures de la promo express (TACHE_commandes_fournisseurs_promo_express.md
// Lot 4a), séparées de l'accès base (lib/promo-express.ts) pour rester
// testables sans Supabase. Dakar est à UTC+0 toute l'année — les méthodes UTC
// de Date donnent directement l'heure locale de Dakar.

export type ConfigPromoExpress = {
  actif: boolean;
  // 0 = dimanche ... 6 = samedi (convention JS Date#getDay).
  joursRecurrents: number[];
  datesPonctuelles: string[]; // "YYYY-MM-DD"
  heureLimite: string; // "HH:MM"
};

export const CONFIG_PROMO_EXPRESS_DEFAUT: ConfigPromoExpress = {
  actif: false,
  joursRecurrents: [5],
  datesPonctuelles: [],
  heureLimite: "18:00",
};

export function validerConfigPromoExpress(v: unknown): ConfigPromoExpress | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.actif !== "boolean") return null;
  if (!Array.isArray(o.joursRecurrents) || !o.joursRecurrents.every((j) => Number.isInteger(j) && j >= 0 && j <= 6)) {
    return null;
  }
  if (
    !Array.isArray(o.datesPonctuelles) ||
    !o.datesPonctuelles.every((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
  ) {
    return null;
  }
  if (typeof o.heureLimite !== "string" || !/^([01]?\d|2[0-3]):[0-5]\d$/.test(o.heureLimite)) return null;
  return {
    actif: o.actif,
    joursRecurrents: o.joursRecurrents as number[],
    datesPonctuelles: o.datesPonctuelles as string[],
    heureLimite: o.heureLimite,
  };
}

// Prochaine date promo à venir (y compris aujourd'hui si l'heure limite n'est
// pas encore passée) — pour "/moi/promos" quand aucune promo n'est active
// maintenant. `null` si la promo est désactivée, ou qu'aucun jour n'est
// configuré (ni récurrent ni ponctuel).
export function prochaineDatePromo(config: ConfigPromoExpress, maintenant: Date = new Date()): string | null {
  if (!config.actif) return null;
  if (config.joursRecurrents.length === 0 && config.datesPonctuelles.length === 0) return null;

  const [h, m] = config.heureLimite.split(":").map(Number);
  const limiteMinutes = h * 60 + m;
  const maintenantMinutes = maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes();
  const heureLimitePasseeAujourdhui = maintenantMinutes >= limiteMinutes;

  const candidats: string[] = [];
  const auj = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()));

  for (const jour of config.joursRecurrents) {
    let delta = (jour - auj.getUTCDay() + 7) % 7;
    if (delta === 0 && heureLimitePasseeAujourdhui) delta = 7;
    const date = new Date(auj);
    date.setUTCDate(date.getUTCDate() + delta);
    candidats.push(date.toISOString().slice(0, 10));
  }

  const aujStr = auj.toISOString().slice(0, 10);
  for (const date of config.datesPonctuelles) {
    if (date > aujStr || (date === aujStr && !heureLimitePasseeAujourdhui)) candidats.push(date);
  }

  if (candidats.length === 0) return null;
  return candidats.sort()[0];
}

// `maintenant` injectable pour les tests ; sinon l'heure réelle.
export function estJourPromoActif(config: ConfigPromoExpress, maintenant: Date = new Date()): boolean {
  if (!config.actif) return false;
  const jour = maintenant.getUTCDay();
  const dateStr = maintenant.toISOString().slice(0, 10);
  const estJourChoisi = config.joursRecurrents.includes(jour) || config.datesPonctuelles.includes(dateStr);
  if (!estJourChoisi) return false;

  const [h, m] = config.heureLimite.split(":").map(Number);
  const limiteMinutes = h * 60 + m;
  const maintenantMinutes = maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes();
  return maintenantMinutes < limiteMinutes;
}
