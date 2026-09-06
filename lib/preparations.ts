import type {
  DeclenchementPreparation,
  StatutDemandePreparation,
} from "@/lib/supabase/types";

// Référence lisible d'une demande de préparation (bon de préparation, listes).
export function refPreparation(id: number): string {
  return `PREP-${String(id).padStart(4, "0")}`;
}

export const LIBELLES_STATUT_DEMANDE: Record<StatutDemandePreparation, string> = {
  a_preparer: "À préparer",
  preparee: "Préparée",
};

// État affiché d'une demande : « Récupérée » prime sur le statut du vendeur.
export type EtatDemande = "a_preparer" | "preparee" | "recuperee";
export function etatDemande(
  statut: StatutDemandePreparation,
  recupereeLe: string | null,
): EtatDemande {
  if (recupereeLe) return "recuperee";
  return statut;
}
export const LIBELLES_ETAT_DEMANDE: Record<EtatDemande, string> = {
  a_preparer: "À préparer",
  preparee: "Préparée",
  recuperee: "Récupérée",
};

// Statuts de commande dont les articles sont « à préparer » : la commande est
// confirmée mais pas encore partie en livraison.
export const STATUTS_COMMANDE_A_PREPARER = ["recue", "preparation"] as const;

// Dakar est à UTC+0 toute l'année (pas d'heure d'été) — l'horodatage du bon de
// préparation « fait foi » (NOTE_ACCES_FOURNISSEURS).
export function formatDateHeureDakar(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Africa/Dakar",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Normalise un téléphone sénégalais pour un lien wa.me (chiffres, indicatif
// 221, sans « + »). Renvoie null si on ne peut rien en faire.
export function numeroWhatsapp(tel: string | null | undefined): string | null {
  const chiffres = (tel ?? "").replace(/\D/g, "");
  if (chiffres.length < 9) return null;
  if (chiffres.startsWith("221")) return chiffres;
  if (chiffres.length === 9) return `221${chiffres}`;
  return chiffres;
}

// --- Modèles de vue partagés (aperçu + bon de préparation) -------------------

export type ArticleAPreparer = {
  produitNom: string;
  varianteLabel: string | null;
  produitPhoto: string | null;
  quantite: number;
};

export type GroupeClient = {
  commandeId: number;
  clientNom: string;
  modeLivraison: string | null;
  zoneNom: string | null;
  articles: ArticleAPreparer[];
};

export type LigneTotal = {
  produitNom: string;
  varianteLabel: string | null;
  quantite: number;
};

export type DemandePreparationDetail = {
  id: number;
  vendeurNom: string;
  vendeurTelephone: string | null;
  statut: StatutDemandePreparation;
  declenchement: DeclenchementPreparation;
  note: string | null;
  creeLe: string;
  prepareeLe: string | null;
  recupereeLe: string | null;
  groupes: GroupeClient[];
  totaux: LigneTotal[];
  nbArticles: number;
};
