import type { OrigineProduit } from "@/lib/accueil-classement";

// Entrelacement du flux d'accueil quand un compte a plusieurs bénéficiaires
// (TACHE_identite §2.4). Pur et testé. Ne mélange JAMAIS les profils dans un
// classement moyenné : chaque produit vient d'un profil précis et porte son
// étiquette.

type ProduitMinimal = { id: number; sous_categorie_id: number | null };

export type CarteProfil<P extends ProduitMinimal> = {
  produit: P;
  origine: OrigineProduit;
};

export type ProfilFlux<P extends ProduitMinimal> = {
  source: "compte" | "beneficiaire";
  prenom: string | null;
  // liste déjà classée + assemblée pour ce seul profil
  cartes: CarteProfil<P>[];
};

export type CarteEntrelacee<P extends ProduitMinimal> = {
  produit: P;
  origine: OrigineProduit;
  // prénom du bénéficiaire d'où vient la carte ; null = compte
  prenom: string | null;
};

const QUOTA_SOUS_CAT = 3;

export function entrelacerAccueil<P extends ProduitMinimal>(
  profils: ProfilFlux<P>[],
  limit: number,
): CarteEntrelacee<P>[] {
  if (profils.length === 0 || limit <= 0) return [];

  // Rotation : bénéficiaires d'abord, compte en dernier (§2.4 : « un produit
  // pour le premier enfant, un pour le second, un issu de l'affinité du compte »).
  const rotation = [
    ...profils.filter((p) => p.source === "beneficiaire"),
    ...profils.filter((p) => p.source === "compte"),
  ];
  if (rotation.length === 0) return [];

  const curseurs = rotation.map(() => 0);
  const fait = rotation.map(() => false);
  const vus = new Set<number>();
  const parSousCat = new Map<number | "na", number>();

  const cle = (scId: number | null) => scId ?? ("na" as const);
  const capOk = (scId: number | null) => (parSousCat.get(cle(scId)) ?? 0) < QUOTA_SOUS_CAT;
  const compter = (scId: number | null) =>
    parSousCat.set(cle(scId), (parSousCat.get(cle(scId)) ?? 0) + 1);

  const sortie: CarteEntrelacee<P>[] = [];
  const gardeMax = (limit + 5) * rotation.length * 3;
  let tour = 0;

  for (let garde = 0; garde < gardeMax; garde++) {
    if (sortie.length >= limit || fait.every(Boolean)) break;
    const k = tour % rotation.length;
    tour++;
    if (fait[k]) continue;

    const profil = rotation[k];
    while (curseurs[k] < profil.cartes.length) {
      const carte = profil.cartes[curseurs[k]++];
      if (vus.has(carte.produit.id)) continue;
      if (!capOk(carte.produit.sous_categorie_id)) continue;
      vus.add(carte.produit.id);
      compter(carte.produit.sous_categorie_id);
      sortie.push({
        produit: carte.produit,
        origine: carte.origine,
        prenom: profil.source === "beneficiaire" ? profil.prenom : null,
      });
      break;
    }
    if (curseurs[k] >= profil.cartes.length) fait[k] = true;
  }

  return sortie;
}
