"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIdAutorise } from "@/lib/client-session";
import { getBeneficiairesActifs, type Beneficiaire } from "@/lib/beneficiaires";

export type BeneficiaireResult =
  | { ok: true; beneficiaires: Beneficiaire[] }
  | { ok: false; error: string };

const PRENOM_MAX = 40;
const NIVEAU_MAX = 40;
const SERIE_MAX = 20;
const ETAB_MAX = 120;
const MAX_BENEFICIAIRES = 12;

type Champs = {
  prenom: string;
  niveau?: string | null;
  serie?: string | null;
  etablissement?: string | null;
};

function nettoyer(champs: Champs): { prenom: string; niveau: string | null; serie: string | null; etablissement: string | null } | null {
  const prenom = String(champs.prenom ?? "").trim().slice(0, PRENOM_MAX);
  if (prenom.length < 1) return null;
  const opt = (v: string | null | undefined, max: number) => {
    const t = String(v ?? "").trim().slice(0, max);
    return t.length ? t : null;
  };
  return {
    prenom,
    niveau: opt(champs.niveau, NIVEAU_MAX),
    serie: opt(champs.serie, SERIE_MAX),
    etablissement: opt(champs.etablissement, ETAB_MAX),
  };
}

export async function listerBeneficiaires(
  telephone: string,
  jeton: string,
): Promise<BeneficiaireResult> {
  const compteId = await clientIdAutorise(telephone, jeton);
  if (!compteId) return { ok: false, error: "Session invalide." };
  return { ok: true, beneficiaires: await getBeneficiairesActifs(compteId) };
}

export async function creerBeneficiaire(
  telephone: string,
  jeton: string,
  champs: Champs,
): Promise<BeneficiaireResult & { id?: number }> {
  const compteId = await clientIdAutorise(telephone, jeton);
  if (!compteId) return { ok: false, error: "Session invalide." };

  const propre = nettoyer(champs);
  if (!propre) return { ok: false, error: "Le prénom est requis." };

  const existants = await getBeneficiairesActifs(compteId);
  if (existants.length >= MAX_BENEFICIAIRES) {
    return { ok: false, error: "Trop de profils enregistrés." };
  }
  // Dédoublonnage souple sur le prénom : si le même prénom existe déjà, on met
  // à jour son niveau plutôt que de créer un doublon (cas « je refais le kit »).
  const meme = existants.find(
    (b) => b.prenom.trim().toLowerCase() === propre.prenom.toLowerCase(),
  );
  if (meme) {
    await supabaseAdmin
      .from("beneficiaires")
      .update({ niveau: propre.niveau, serie: propre.serie, etablissement: propre.etablissement })
      .eq("id", meme.id)
      .eq("compte_id", compteId);
    return { ok: true, id: meme.id, beneficiaires: await getBeneficiairesActifs(compteId) };
  }

  const { data, error } = await supabaseAdmin
    .from("beneficiaires")
    .insert({ compte_id: compteId, ...propre })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Impossible d'enregistrer ce profil." };
  return { ok: true, id: data.id as number, beneficiaires: await getBeneficiairesActifs(compteId) };
}

export async function modifierBeneficiaire(
  telephone: string,
  jeton: string,
  id: number,
  champs: Champs,
): Promise<BeneficiaireResult> {
  const compteId = await clientIdAutorise(telephone, jeton);
  if (!compteId) return { ok: false, error: "Session invalide." };
  const propre = nettoyer(champs);
  if (!propre) return { ok: false, error: "Le prénom est requis." };

  const { error } = await supabaseAdmin
    .from("beneficiaires")
    .update(propre)
    .eq("id", id)
    .eq("compte_id", compteId);
  if (error) return { ok: false, error: "Impossible de modifier ce profil." };
  return { ok: true, beneficiaires: await getBeneficiairesActifs(compteId) };
}

export async function desactiverBeneficiaire(
  telephone: string,
  jeton: string,
  id: number,
): Promise<BeneficiaireResult> {
  const compteId = await clientIdAutorise(telephone, jeton);
  if (!compteId) return { ok: false, error: "Session invalide." };

  const { error } = await supabaseAdmin
    .from("beneficiaires")
    .update({ actif: false })
    .eq("id", id)
    .eq("compte_id", compteId);
  if (error) return { ok: false, error: "Impossible de retirer ce profil." };
  return { ok: true, beneficiaires: await getBeneficiairesActifs(compteId) };
}
