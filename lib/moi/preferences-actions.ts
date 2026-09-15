"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIdAutorise } from "@/lib/client-session";
import { getPreferences } from "@/lib/messages/preferences";
import type { PreferencesUtilisateur, Theme, TailleTexte } from "@/lib/supabase/types";

// Préférences de notifications push (TACHE_notifications_client.md §8).
// Trois familles indépendantes, jamais un seul interrupteur global.

export type FamillePreference = "suivi_commandes" | "produits_attendus" | "rentree_nouveautes";

export type PreferencesResult = Omit<PreferencesUtilisateur, "client_id" | "maj_le">;

const DEFAUT_AFFICHAGE = {
  theme: "systeme" as Theme,
  taille_texte: "normale" as TailleTexte,
  personnalisation: true,
  localite_defaut_id: null as number | null,
  lieu_special_defaut_id: null as number | null,
  precision_livreur: null as string | null,
};

async function getPreferencesCompletes(clientId: number): Promise<PreferencesResult> {
  const { data } = await supabaseAdmin
    .from("preferences_utilisateur")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (data) {
    return {
      suivi_commandes: data.suivi_commandes,
      produits_attendus: data.produits_attendus,
      rentree_nouveautes: data.rentree_nouveautes,
      theme: data.theme,
      taille_texte: data.taille_texte,
      personnalisation: data.personnalisation,
      localite_defaut_id: data.localite_defaut_id,
      lieu_special_defaut_id: data.lieu_special_defaut_id,
      precision_livreur: data.precision_livreur,
    };
  }
  const notif = await getPreferences(clientId);
  return { ...notif, ...DEFAUT_AFFICHAGE };
}

async function ecrirePreferences(
  clientId: number,
  champs: Partial<Omit<PreferencesUtilisateur, "client_id" | "maj_le">>,
): Promise<{ ok: boolean }> {
  const actuelles = await getPreferencesCompletes(clientId);
  const { error } = await supabaseAdmin.from("preferences_utilisateur").upsert(
    {
      client_id: clientId,
      ...actuelles,
      ...champs,
      maj_le: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  return { ok: !error };
}

export async function getPreferencesNotifications(
  telephone: string,
  jeton: string,
): Promise<PreferencesResult | null> {
  const clientId = await clientIdAutorise(telephone, jeton);
  if (!clientId) return null;
  return getPreferencesCompletes(clientId);
}

export async function setPreferenceNotification(
  telephone: string,
  jeton: string,
  famille: FamillePreference,
  valeur: boolean,
): Promise<{ ok: boolean }> {
  const clientId = await clientIdAutorise(telephone, jeton);
  if (!clientId) return { ok: false };
  return ecrirePreferences(clientId, { [famille]: valeur });
}

// Section Affichage — thème et taille de texte sont d'abord appliqués en
// local (lib/local/theme.ts, lib/local/taille-texte.ts) pour un rendu
// instantané sans clignotement ; cet appel les synchronise côté serveur
// (best effort, ne bloque jamais l'application locale du réglage).
export async function synchroniserAffichage(
  telephone: string,
  jeton: string,
  champs: { theme?: Theme; taille_texte?: TailleTexte },
): Promise<{ ok: boolean }> {
  const clientId = await clientIdAutorise(telephone, jeton);
  if (!clientId) return { ok: false };
  return ecrirePreferences(clientId, champs);
}

export async function setPersonnalisation(
  telephone: string,
  jeton: string,
  valeur: boolean,
): Promise<{ ok: boolean }> {
  const clientId = await clientIdAutorise(telephone, jeton);
  if (!clientId) return { ok: false };
  return ecrirePreferences(clientId, { personnalisation: valeur });
}

export type LivraisonDefaut = {
  localiteDefautId: number | null;
  lieuSpecialDefautId: number | null;
  precisionLivreur: string | null;
};

export async function setLivraisonDefaut(
  telephone: string,
  jeton: string,
  valeur: LivraisonDefaut,
): Promise<{ ok: boolean }> {
  const clientId = await clientIdAutorise(telephone, jeton);
  if (!clientId) return { ok: false };
  return ecrirePreferences(clientId, {
    localite_defaut_id: valeur.localiteDefautId,
    lieu_special_defaut_id: valeur.lieuSpecialDefautId,
    precision_livreur: valeur.precisionLivreur,
  });
}
