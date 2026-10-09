import "server-only";
import { cookies } from "next/headers";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getPopulaires, getProduitsByIds } from "@/lib/supabase/queries";
import {
  aleaSeed,
  assemblerAccueil,
  type LigneAccueil,
  type OrigineProduit,
} from "@/lib/accueil-classement";
import { getProfilsAffichage } from "@/lib/affinites";
import { entrelacerAccueil } from "@/lib/accueil-multi";
import { ordonnerAccueil } from "@/lib/accueil-diversite";
import type { Produit } from "@/lib/supabase/types";

// Graine dérivée de la session (cookie `sacado_sid`) : la même personne, dans
// la même visite, retombe sur le même mélange des places d'exploration. Le
// chargement continu (maj-accueil §6) peut donc rappeler `getAccueilFeed` avec
// une limite plus grande sans que le début du flux déjà affiché ne bouge.
function seedDeChaine(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h || 1;
}
async function aleaSession(): Promise<() => number> {
  let sid = "anon";
  try {
    sid = (await cookies()).get("sacado_sid")?.value ?? "anon";
  } catch {
    sid = "anon";
  }
  return aleaSeed(seedDeChaine(sid));
}

export type ProduitAccueil = Produit & { origine: OrigineProduit };

// maj-accueil §5 : les ordinateurs à 175 000 F ou plus n'apparaissent jamais
// sur l'accueil (ils restent dans leur catégorie et dans la recherche).
const CATEGORIE_ORDINATEURS_ID = 7;
const SEUIL_ORDINATEUR_EXCLU_ACCUEIL = 175000;
function exclureOrdinateursChers<T extends { categorie_id: number | null; prix: number }>(
  liste: T[],
): T[] {
  return liste.filter(
    (p) => !(p.categorie_id === CATEGORIE_ORDINATEURS_ID && p.prix >= SEUIL_ORDINATEUR_EXCLU_ACCUEIL),
  );
}

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
export async function getAccueilFeed(limit = 20, dejaAffichees = 0): Promise<AccueilFeed> {
  const { facteur, profils: profilsAff } = await getProfilsAffichage();
  const alea = await aleaSession();

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
    const repli = exclureOrdinateursChers(await getPopulaires(limit));
    return {
      multi: false,
      profils: [
        {
          source: "compte",
          id: null,
          prenom: null,
          produits: ordonnerAccueil(repli.map((p) => ({ ...p, origine: "score" as const }))),
        },
      ],
    };
  }

  const lignesParProfilBrut = reponses.map((r) => (r.data ?? []) as LigneAccueil[]);
  const tousIds = [...new Set(lignesParProfilBrut.flat().map((l) => l.produit_id))];
  const produits = await getProduitsByIds(tousIds);
  const parId = new Map(produits.map((p) => [p.id, p]));
  const lignesParProfil = lignesParProfilBrut.map((lignes) =>
    lignes.filter((l) => {
      const p = parId.get(l.produit_id);
      return !p || !(p.categorie_id === CATEGORIE_ORDINATEURS_ID && p.prix >= SEUIL_ORDINATEUR_EXCLU_ACCUEIL);
    }),
  );

  const profils: ProfilAccueil[] = profilsAff.map((pr, i) => {
    const places = assemblerAccueil(lignesParProfil[i], limit, alea);
    const produits = places
      .map((c) => {
        const p = parId.get(c.produitId);
        return p ? { ...p, origine: c.origine } : null;
      })
      .filter((p): p is ProduitAccueil => p !== null);
    // Mis en avant (maj-accueil §5) : les produits épinglés (`classement_manuel`)
    // doivent ouvrir le flux, dans l'ordre de leur position. `ordonnerAccueil`
    // (rentrée d'abord + variété) ne s'applique donc qu'au reste — sinon un
    // épinglage pouvait glisser de sa case (voir commentaire dans
    // lib/accueil-diversite.ts).
    const misEnAvant = produits.filter((p) => p.origine === "epingle");
    const reste = produits.filter((p) => p.origine !== "epingle");
    return {
      source: pr.source,
      id: pr.id,
      prenom: pr.prenom,
      produits: [...misEnAvant, ...ordonnerAccueil(reste)],
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
  // Chargement continu (maj-accueil §6) : `dejaAffichees` évite de recompter,
  // à chaque page suivante, les impressions déjà journalisées pour le début du
  // flux — seule la nouvelle portion est mesurée.
  const nouvelles = affichees.slice(dejaAffichees);
  if (nouvelles.length > 0) {
    // Best-effort réel : exécuté après l'envoi de la réponse (évite d'ajouter
    // un aller-retour Supabase supplémentaire au temps de réponse perçu).
    after(async () => {
      try {
        await supabaseAdmin.rpc("enregistrer_impressions_accueil", { p_items: nouvelles });
      } catch {
        // best-effort
      }
    });
  }

  return { multi: profils.length > 1, profils };
}
