import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  COOKIE_NIVEAU,
  classeComplete,
  cycleDeNiveau,
  decoderNiveau,
  tokensNiveau,
} from "@/lib/niveau";
import { getBeneficiairesActifs } from "@/lib/beneficiaires";

// Affinités de la personne courante pour l'affichage classé
// (TACHE_algorithme_classement.md §3 couche 2 + TACHE_identite Partie 2).
// Lecture via service_role : tables d'affinité et `config_classement` en RLS
// sans policy.

const SID_COOKIE = "sacado_sid";

export type ProfilAffinite = {
  source: "compte" | "beneficiaire";
  // id du bénéficiaire, ou null pour le compte
  id: number | null;
  prenom: string | null;
  // sous_categorie_id (texte) -> poids normalisé [0,1]
  affinites: Record<string, number>;
};

export type ProfilsAffichage = {
  // false quand l'admin a coupé la personnalisation pour tout le monde (§6.5)
  perso: boolean;
  // config_classement.poids_affinite (défaut 0.6)
  facteur: number;
  // [0] = compte ; [1..] = bénéficiaires actifs, du plus ancien au plus récent
  profils: ProfilAffinite[];
};

const PROFIL_COMPTE_VIDE: ProfilAffinite = {
  source: "compte",
  id: null,
  prenom: null,
  affinites: {},
};

export async function getProfilsAffichage(): Promise<ProfilsAffichage> {
  try {
    const jar = await cookies();

    const { data: cfg } = await supabaseAdmin
      .from("config_classement")
      .select("cle, valeur")
      .in("cle", ["perso_active", "poids_affinite"]);
    const conf = new Map((cfg ?? []).map((r) => [r.cle as string, Number(r.valeur)]));
    const perso = (conf.get("perso_active") ?? 1) !== 0;
    const facteur = conf.get("poids_affinite") ?? 0.6;

    if (!perso) {
      return { perso: false, facteur, profils: [PROFIL_COMPTE_VIDE] };
    }

    const sid = jar.get(SID_COOKIE)?.value ?? null;
    let compteId: number | null = null;

    if (sid) {
      const { data: lien } = await supabaseAdmin
        .from("sessions_comptes")
        .select("compte_id")
        .eq("session_id", sid)
        .maybeSingle();
      compteId = (lien?.compte_id ?? null) as number | null;
    }

    // --- Affinité du compte (ou de la session anonyme) ---
    let compteAff: Record<string, number> = {};
    if (compteId) {
      compteAff = await affiniteMesuree("affinites_utilisateur", "utilisateur_id", compteId);
    } else if (sid) {
      compteAff = await affiniteMesuree("affinites_session", "session_id", sid);
    }
    if (Object.keys(compteAff).length === 0) {
      // Démarrage à froid : niveau déclaré au sélecteur de kit.
      const niv = decoderNiveau(jar.get(COOKIE_NIVEAU)?.value);
      if (niv) compteAff = await affiniteDesJetons(tokensNiveau(niv.classe, niv.cycle));
    }

    const profils: ProfilAffinite[] = [
      { source: "compte", id: null, prenom: null, affinites: compteAff },
    ];

    // --- Un profil par bénéficiaire actif ---
    if (compteId) {
      const benefs = await getBeneficiairesActifs(compteId);
      for (const b of benefs) {
        let aff = await affiniteMesuree("affinites_beneficiaire", "beneficiaire_id", b.id);
        if (Object.keys(aff).length === 0) {
          aff = await affiniteDesJetons(
            tokensNiveau(classeComplete(b.niveau, b.serie), cycleDeNiveau(b.niveau)),
          );
        }
        profils.push({ source: "beneficiaire", id: b.id, prenom: b.prenom, affinites: aff });
      }
    }

    return { perso: true, facteur, profils };
  } catch {
    return { perso: true, facteur: 0.6, profils: [PROFIL_COMPTE_VIDE] };
  }
}

// Poids mesurés d'une table d'affinité, normalisés min-max (le plus fort -> 1.0).
async function affiniteMesuree(
  table: "affinites_utilisateur" | "affinites_session" | "affinites_beneficiaire",
  colonne: "utilisateur_id" | "session_id" | "beneficiaire_id",
  valeur: number | string,
): Promise<Record<string, number>> {
  const { data } = await supabaseAdmin
    .from(table)
    .select("sous_categorie_id, poids")
    .eq(colonne, valeur);
  const lignes = (data ?? []) as { sous_categorie_id: number; poids: number }[];
  if (lignes.length === 0) return {};
  const max = Math.max(...lignes.map((l) => Number(l.poids)));
  if (!(max > 0)) return {};
  const out: Record<string, number> = {};
  for (const l of lignes) out[String(l.sous_categorie_id)] = Number(l.poids) / max;
  return out;
}

// Coup de pouce dérivé d'un ou plusieurs jetons de niveau : les sous-catégories
// des catégories listées dans `niveaux_categories` reçoivent (coef - 1) borné [0,1].
async function affiniteDesJetons(jetons: string[]): Promise<Record<string, number>> {
  if (jetons.length === 0) return {};
  const { data: nc } = await supabaseAdmin
    .from("niveaux_categories")
    .select("categorie_id, coefficient")
    .in("niveau", jetons);
  if (!nc || nc.length === 0) return {};

  const coefParCat = new Map<number, number>();
  for (const r of nc) {
    const cid = r.categorie_id as number;
    coefParCat.set(cid, Math.max(coefParCat.get(cid) ?? 0, Number(r.coefficient)));
  }

  const { data: scs } = await supabaseAdmin
    .from("sous_categories")
    .select("id, categorie_id")
    .in("categorie_id", [...coefParCat.keys()]);

  const out: Record<string, number> = {};
  for (const sc of scs ?? []) {
    const coef = coefParCat.get(sc.categorie_id as number);
    if (coef && coef > 1) out[String(sc.id)] = Math.min(1, coef - 1);
  }
  return out;
}

// Fusion de la session anonyme dans le compte, après résolution du client à la
// commande (TACHE_identite §1.4). Best-effort.
export async function fusionnerSessionCourante(clientId: number): Promise<void> {
  try {
    const jar = await cookies();
    const sid = jar.get(SID_COOKIE)?.value;
    if (!sid) return;
    await supabaseAdmin.rpc("fusionner_session", { p_session: sid, p_client: clientId });
  } catch {
    // best-effort
  }
}
