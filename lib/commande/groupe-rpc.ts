import { estGroupeListe, type GroupePanier } from "@/lib/local/panier";

// Mapping groupe de panier -> colonnes `kit_*` de commande_items (migration
// 0100), partagé par checkout/actions.ts et ajout/actions.ts (auparavant
// dupliqué à l'identique dans les deux). Une liste personnalisée remplit
// kit_groupe_id + kit_nom (son titre) ; kit_id/kit_classe/kit_gamme/
// kit_beneficiaire_prenom restent null (pas de taxonomie catalogue, pas de
// bénéficiaire sur une liste).
export function champsGroupePourRpc(groupe: GroupePanier | null) {
  if (!groupe) {
    return {
      kit_groupe_id: null,
      kit_id: null,
      kit_nom: null,
      kit_classe: null,
      kit_gamme: null,
      kit_beneficiaire_prenom: null,
    };
  }

  if (estGroupeListe(groupe)) {
    return {
      kit_groupe_id: groupe.id,
      kit_id: null,
      kit_nom: groupe.titre,
      kit_classe: null,
      kit_gamme: null,
      kit_beneficiaire_prenom: null,
    };
  }

  return {
    kit_groupe_id: groupe.id,
    kit_id: groupe.kitId,
    kit_nom: `${groupe.niveau} · ${groupe.gammeLabel}`,
    kit_classe: groupe.niveau,
    kit_gamme: groupe.gammeLabel,
    kit_beneficiaire_prenom: groupe.beneficiairePrenom ?? null,
  };
}
