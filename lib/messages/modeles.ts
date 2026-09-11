import type { CanalModele, StatutCommande } from "@/lib/supabase/types";

// Code d'événement associé à un statut de commande. Doit rester aligné avec le
// mapping du trigger notify_commande_statut() (migration 0058).
export function codeModeleStatut(statut: StatutCommande): string | null {
  switch (statut) {
    case "recue":
      return "commande_confirmee";
    case "preparation":
      return "commande_preparation";
    case "livraison":
      return "commande_route";
    case "livree":
      return "commande_livree";
    case "probleme":
      return "commande_probleme";
    default:
      return null;
  }
}

// Rendu des modèles de messages (migration 0057). Isomorphe : utilisable côté
// serveur (envoi) comme côté client (aperçu dans l'admin).

// Variables reconnues dans le contenu d'un modèle. Une variable absente du jeu
// fourni est remplacée par une chaîne vide (jamais « {prenom} » en clair).
export type VariablesModele = Partial<
  Record<
    | "prenom"
    | "numero_commande"
    | "montant"
    | "localite"
    | "articles"
    | "lien_commande"
    | "lien_produit"
    | "lien",
    string | number | null | undefined
  >
>;

export const VARIABLES_MODELE = [
  "prenom",
  "numero_commande",
  "montant",
  "localite",
  "articles",
  "lien_commande",
  "lien_produit",
  "lien",
] as const;

export function rendreModele(contenu: string, variables: VariablesModele): string {
  return contenu.replace(/\{(\w+)\}/g, (entier, cle: string) => {
    const valeur = (variables as Record<string, unknown>)[cle];
    return valeur === undefined || valeur === null ? "" : String(valeur);
  });
}

// Libellés lisibles des canaux, pour l'admin.
export const LIBELLE_CANAL: Record<CanalModele, string> = {
  whatsapp: "WhatsApp",
  push: "Notification push",
  inbox: "Boîte de réception",
};
