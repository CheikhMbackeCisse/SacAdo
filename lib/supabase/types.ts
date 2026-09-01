export type Delai = "24h" | "5j";
export type StatutProduit = "dispo" | "sur_commande" | "epuise";
// Marketplace : circuit de modération d'un produit vendeur.
//   en_attente  : soumis, pas encore traité par l'admin ;
//   negociation : au moins une contre-proposition de prix a été faite ;
//   publie      : prix accepté des deux côtés → visible au catalogue ;
//   refuse      : abandonné par l'une des parties.
export type StatutPublication = "en_attente" | "negociation" | "publie" | "refuse";
export type StatutVariante = "dispo" | "epuise";
export type Cycle = "prescolaire" | "elementaire" | "college" | "lycee";
export type Gamme = "essentiel" | "confort" | "complet";

export type Produit = {
  id: number;
  nom: string;
  // FK vers categories (obligatoire)
  categorie_id: number;
  // FK vers sous_categories ; null = produit sans sous-catégorie
  sous_categorie_id: number | null;
  prix: number;
  delai: Delai;
  // Photo principale (= photos[0], maintenue par le serveur). Reste la source
  // de vérité pour les cartes catalogue et les RPC de recherche.
  photo: string | null;
  // Galerie ordonnée (jusqu'à 4). photos[0] = principale. Vide pour les
  // produits SacAdo tant qu'ils n'ont pas été migrés vers la galerie.
  photos: string[];
  stock: number;
  seuil_alerte: number;
  statut: StatutProduit;
  created_at: string;
  description: string | null;
  // Marketplace : null = produit SacAdo en propre ; sinon = produit d'un vendeur.
  vendeur_id: string | null;
  statut_publication: StatutPublication;
  motif_refus: string | null;
};

// Catégories : source de vérité en base (table `categories`). Les icônes Lucide
// et les placeholders de recherche restent en code (lib/category-presentation.ts).
export type Categorie = {
  id: number;
  nom: string;
  slug: string;
  ordre: number;
  image: string | null;
  actif: boolean;
  created_at: string;
};

export type SousCategorie = {
  id: number;
  nom: string;
  categorie_id: number;
  slug: string;
  ordre: number;
  created_at: string;
};

// Marketplace : taux de commission SacAdo prélevé sur un produit vendeur.
// Portée : (null, null) = taux global ; (categorie_id, null) = taux catégorie ;
// (null, sous_categorie_id) = taux sous-catégorie.
export type Commission = {
  id: number;
  categorie_id: number | null;
  sous_categorie_id: number | null;
  taux: number;
  created_at: string;
};

// Marketplace : négociation de prix admin ↔ vendeur.
export type AuteurProposition = "vendeur" | "admin";
// Statut d'UNE proposition (pas du produit).
export type StatutProposition = "en_cours" | "accepte" | "refuse";

export type NegociationProposition = {
  id: number;
  produit_id: number;
  auteur: AuteurProposition;
  prix_propose: number;
  statut: StatutProposition;
  date: string;
};

export type TypeMessageVendeur = "negociation" | "publication" | "refus" | "info";

export type MessageVendeur = {
  id: number;
  vendeur_id: string;
  type: TypeMessageVendeur;
  titre: string;
  corps: string;
  produit_id: number | null;
  lu: boolean;
  date: string;
};

export type ProduitVariante = {
  id: number;
  produit_id: number;
  couleur: string | null;
  taille: string | null;
  prix: number | null;
  stock: number;
  statut: StatutVariante;
  photo: string | null;
  created_at: string;
};

export type Kit = {
  id: number;
  cycle: Cycle;
  niveau: string;
  gamme: Gamme;
  nom: string;
  created_at: string;
};

export type KitItem = {
  id: number;
  kit_id: number;
  produit_id: number;
  quantite_defaut: number;
};

export type Zone = {
  id: number;
  nom: string;
  tarif_5j: number;
  tarif_24h: number;
};

export type ModeLivraison = "24h" | "5j";
export type ModePaiement = "livraison";
export type StatutCommande = "recue" | "preparation" | "livraison" | "livree";

export type Client = {
  id: number;
  nom: string;
  telephone: string;
  zone_id: number | null;
  date_creation: string;
};

export type Commande = {
  id: number;
  client_id: number;
  zone_id: number;
  adresse: string | null;
  mode_livraison: ModeLivraison;
  frais_livraison: number;
  mode_paiement: ModePaiement;
  sous_total: number;
  total: number;
  statut: StatutCommande;
  date: string;
  client_reference: string | null;
  // Prénom(s) d'enfant pour la personnalisation de l'ebook offert avec un kit.
  enfants_ebook: string | null;
};

export type CommandeItem = {
  id: number;
  commande_id: number;
  produit_id: number;
  variante_id: number | null;
  quantite: number;
  prix_unitaire: number;
};

// Marketplace V2 — comptes back-office et vendeurs (id = auth.users.id).
export type Admin = {
  user_id: string;
  email: string | null;
  created_at: string;
};

export type Vendeur = {
  id: string;
  nom_boutique: string;
  contact_nom: string | null;
  contact_telephone: string | null;
  infos_reversement: string | null;
  date_creation: string;
};

export type TypeMessage = "commande" | "info" | "promo";

export type Message = {
  id: number;
  client_id: number;
  type: TypeMessage;
  titre: string;
  corps: string;
  lu: boolean;
  date: string;
};
