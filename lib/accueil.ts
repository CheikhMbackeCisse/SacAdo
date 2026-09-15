import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPopulaires, getProduitsByIds } from "@/lib/supabase/queries";
import {
  assemblerAccueil,
  type LigneAccueil,
  type OrigineProduit,
} from "@/lib/accueil-classement";
import { getProfilsAffichage } from "@/lib/affinites";
import { entrelacerAccueil } from "@/lib/accueil-multi";
import type { Produit } from "@/lib/supabase/types";

export type ProduitAccueil = Produit & { origine: OrigineProduit };

export type ProfilAccueil = {
  source: "compte" | "beneficiaire";
  id: number | null;
  prenom: string | null;
  produits: ProduitAccueil[];
};

export type AccueilFeed = {
  // true dès qu'il y a au moins un bénéficiaire -> puces + entrelacement
  multi: boolean;
  // [0] = compte ; [1..] = bénéficiaires
  profils: ProfilAccueil[];
};

// Flux d'accueil classé + personnalisé (TACHE_algorithme_classement.md §3-4 +
// TACHE_identite §2.4). Un appel RPC par profil (compte + chaque bénéficiaire),
// en parallèle ; chaque appel ne fait qu'un tri sur colonne indexée + jointure.
// Aucune lecture de `evenements`.
export async function getAccueilFeed(limit = 20): Promise<AccueilFeed> {
  const { facteur, profils: profilsAff } = await getProfilsAffichage();

  const reponses = await Promise.all(
    profilsAff.map((pr) =>
      supabaseAdmin.rpc("accueil_classement", {
        p_limit: limit,
        p_affinites: pr.affinites,
        p_facteur: facteur,
      }),
    ),
  );

  if (reponses.some((r) => r.error)) {
    console.warn(
      "accueil_classement indisponible, repli populaires :",
      reponses.find((r) => r.error)?.error?.message,
    );
    const repli = await getPopulaires(limit);
    return {
      multi: false,
      profils: [
        {
          source: "compte",
          id: null,
          prenom: null,
          produits: repli.map((p) => ({ ...p, origine: "score" as const })),
        },
      ],
    };
  }

  const lignesParProfil = reponses.map((r) => (r.data ?? []) as LigneAccueil[]);
  const tousIds = [...new Set(lignesParProfil.flat().map((l) => l.produit_id))];
  const produits = await getProduitsByIds(tousIds);
  const parId = new Map(produits.map((p) => [p.id, p]));

  const profils: ProfilAccueil[] = profilsAff.map((pr, i) => {
    const places = assemblerAccueil(lignesParProfil[i], limit);
    return {
      source: pr.source,
      id: pr.id,
      prenom: pr.prenom,
      produits: places
        .map((c) => {
          const p = parId.get(c.produitId);
          return p ? { ...p, origine: c.origine } : null;
        })
        .filter((p): p is ProduitAccueil => p !== null),
    };
  });

  // Mesure du rendement de l'exploration (§6.7) : on journalise la vue par
  // défaut (« Tous » entrelacé, ou le profil unique). Best-effort.
  const affichees =
    profils.length > 1
      ? entrelacerAccueil(
          profils.map((p) => ({
            source: p.source,
            prenom: p.prenom,
            cartes: p.produits.map((pr) => ({ produit: pr, origine: pr.origine })),
          })),
          limit,
        ).map((c) => ({ produit_id: c.produit.id, origine: c.origine }))
      : (profils[0]?.produits ?? []).map((pr) => ({ produit_id: pr.id, origine: pr.origine }));
  try {
    await supabaseAdmin.rpc("enregistrer_impressions_accueil", { p_items: affichees });
  } catch {
    // best-effort
  }

  return { multi: profils.length > 1, profils };
}
