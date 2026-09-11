export type Delai = "24h" | "6j";
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
// Livres et annales (migration 0068) : édition la plus récente vs. édition
// antérieure au programme actuel, toujours vendable.
export type EditionStatut = "en_vigueur" | "ancienne";

export type Produit = {
  id: number;
  nom: string;
  // FK vers categories (obligatoire)
  categorie_id: number;
  // FK vers sous_categories ; null = produit sans sous-catégorie
  sous_categorie_id: number | null;
  // FK vers sous_sous_categories ; null = la sous-catégorie n'a pas de 3e niveau
  // (ou produit pas encore rangé). Le 3e niveau est optionnel (SOUS_SOUS_CATEGORIES.md).
  sous_sous_categorie_id: number | null;
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
  // Mots-clés libres pour la recherche (migration 0041) : ce que les clients
  // tapent et qui n'est écrit nulle part sur le produit. Alimente
  // `recherche_texte`, jamais affiché au client.
  mots_cles: string | null;
  // Marketplace : null = produit SacAdo en propre ; sinon = produit d'un vendeur.
  vendeur_id: string | null;
  statut_publication: StatutPublication;
  motif_refus: string | null;
  // Remarque libre laissée par le vendeur à l'attention de SacAdo (migration 0029).
  commentaire_vendeur: string | null;
  // Qui a mis le produit en ligne (migration 0036) :
  //   'admin'   : publié par l'admin au nom d'un vendeur -> en ligne direct ;
  //   'vendeur' : soumis par le vendeur -> passe par la validation admin.
  publie_par: "admin" | "vendeur";
  // Prix d'achat FCFA (migration 0046) : base de la composante « marge » du
  // score global. null = coût inconnu -> le produit n'est ni avantagé ni
  // pénalisé par la marge. Absent des lectures storefront (jamais exposé à
  // l'API publique) -> optionnel.
  prix_achat?: number | null;
  // Classement (migration 0047) : recalculés chaque nuit par pg_cron, jamais à
  // la lecture. `score_details` = décomposition JSON pour l'écran admin.
  // Chargés seulement par les requêtes qui en ont besoin (accueil classé, admin)
  // -> optionnels.
  score_global?: number;
  score_details?: ScoreDetails | null;
  vues_30j?: number;
  // Livres et annales (migration 0068). Tous nullables : seuls les produits
  // de la catégorie "Livres et annales" les renseignent.
  niveau: string | null;
  serie: string | null;
  matiere: string | null;
  type_ouvrage: string | null;
  auteur: string | null;
  editeur: string | null;
  edition: string | null;
  edition_statut: EditionStatut | null;
  // Années couvertes par le recueil d'épreuves (concours/annales), ex. "2004 à 2025".
  couverture_epreuves: string | null;
  // Partagé par toutes les éditions d'un même ouvrage ; null = édition unique.
  ouvrage_id: number | null;
};

export type ScoreDetails = {
  performance: number;
  saisonnalite: number;
  marge: number;
  fraicheur: number;
  score: number;
  vues_30j: number;
  calcule_le: string;
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

// 3e niveau, optionnel : n'existe que pour les sous-catégories où c'est pertinent
// (SOUS_SOUS_CATEGORIES.md). Table `sous_sous_categories`, migration 0030.
export type SousSousCategorie = {
  id: number;
  nom: string;
  slug: string;
  sous_categorie_id: number;
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

export type TypeMessageVendeur =
  | "negociation"
  | "publication"
  | "refus"
  | "info"
  | "preparation";

export type MessageVendeur = {
  id: number;
  vendeur_id: string;
  type: TypeMessageVendeur;
  titre: string;
  corps: string;
  produit_id: number | null;
  // Lien vers la demande de préparation (type 'preparation', migration 0039).
  demande_preparation_id: number | null;
  lu: boolean;
  date: string;
};

export type ProduitVariante = {
  id: number;
  produit_id: number;
  prix: number | null;
  stock: number;
  statut: StatutVariante;
  photo: string | null;
  created_at: string;
};

// Attributs de variante (Couleur, Taille, Poids...) — liste commune, un vendeur
// peut en proposer un nouveau, l'admin valide (migration 0022).
export type StatutAttribut = "propose" | "valide";

export type Attribut = {
  id: number;
  nom: string;
  statut: StatutAttribut;
  propose_par: string | null;
  created_at: string;
};

// Valeur d'un attribut portée par une variante, avec le nom de l'attribut joint.
export type VarianteAttributValeur = {
  attribut_id: number;
  nom: string;
  valeur: string;
};

export type VarianteAvecAttributs = ProduitVariante & {
  attributs: VarianteAttributValeur[];
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

// Ebook PDF offert à l'achat d'un kit (MODULE_EBOOKS.md). Fichier rangé dans le
// bucket privé `ebooks` ; jamais servi en public, seulement via URL signée.
export type Ebook = {
  id: number;
  titre: string;
  fichier_chemin: string;
  taille_octets: number | null;
  created_at: string;
  updated_at: string;
};

// Quelle classe (cycle + niveau) reçoit quel ebook. Une classe = au plus une ligne.
export type EbookClasse = {
  id: number;
  ebook_id: number;
  cycle: Cycle;
  niveau: string;
};

export type Zone = {
  id: number;
  nom: string;
  tarif_6j: number;
  tarif_24h: number;
  // Si renseigné : remplace le délai « 24h / 6j » partout pour ce groupe
  // (migration 0054). Vide = délai normal.
  message_special: string | null;
};

// Localité choisie/saisie par le client au checkout (IMPLEMENTATION_TARIFS_LIVRAISON.md) :
// détermine le tarif via son groupe (`zones`, réutilisée comme groupe de livraison).
export type Localite = {
  id: number;
  nom: string;
  // minuscules, sans accents, espaces resserrés (trigger, migration 0053).
  nom_normalise: string;
  groupe_id: number;
  lat: number | null;
  lng: number | null;
  created_at: string;
};

// Cas particulier avec son propre tarif/mode, en dehors du système de groupes
// (retrait à Thiès, EPT, "autres régions" à confirmer).
export type ModeLieuSpecial = "livraison" | "retrait" | "a_confirmer";

export type LieuSpecial = {
  id: number;
  nom: string;
  // NULL uniquement quand mode = 'a_confirmer'.
  tarif: number | null;
  mode: ModeLieuSpecial;
  message: string | null;
  created_at: string;
};

export type ModeLivraison = "24h" | "6j";
// 'livraison' = payé au livreur à la remise ; 'wave' = payé en ligne d'avance
// (INTEGRATION_WAVE.md, migration 0023).
export type ModePaiement = "livraison" | "wave";
// Cycle de vie du paiement Wave. NULL sur une commande payée à la livraison.
export type StatutPaiement = "en_attente" | "payee" | "echoue" | "annulee";
// 'paiement_en_attente' : commande Wave créée, webhook pas encore confirmé —
// hors du flux de préparation tant qu'elle n'est pas passée 'recue'.
export type StatutCommande =
  | "paiement_en_attente"
  | "recue"
  | "preparation"
  | "livraison"
  | "livree"
  // État d'exception (migration 0058) : souci sur la commande (article
  // indisponible…). L'admin y passe pour prévenir le client, puis reprend le
  // flux normal.
  | "probleme";

export type Client = {
  id: number;
  nom: string;
  telephone: string;
  // Numéro normalisé `221XXXXXXXXX` pour wa.me (migration 0056). NULL = numéro
  // saisi inexploitable — le bouton WhatsApp est masqué et l'anomalie signalée.
  telephone_normalise: string | null;
  zone_id: number | null;
  date_creation: string;
};

export type Commande = {
  id: number;
  client_id: number;
  // NULL pour un lieu spécial ou une localité non reconnue (aucun groupe).
  zone_id: number | null;
  adresse: string | null;
  mode_livraison: ModeLivraison;
  frais_livraison: number;
  mode_paiement: ModePaiement;
  sous_total: number;
  total: number;
  statut: StatutCommande;
  date: string;
  client_reference: string | null;
  // Paiement Wave (INTEGRATION_WAVE.md, migration 0023). Tous NULL pour une
  // commande payée à la livraison.
  statut_paiement: StatutPaiement | null;
  wave_session_id: string | null;
  wave_event_id: string | null;
  montant_paye: number | null;
  // Historique : prénom(s) d'enfant saisis à la commande quand l'ebook offert
  // était personnalisé. L'ebook n'est plus personnalisé (MODULE_EBOOKS.md) ;
  // colonne conservée pour les anciennes commandes, plus alimentée.
  enfants_ebook: string | null;
  // Point de livraison validé sur la carte (LOCALISATION_LIVRAISON.md) + note
  // libre pour le livreur. Peuvent être null pour les commandes d'avant 0021.
  lat: number | null;
  lng: number | null;
  precision_livreur: string | null;
  // Livraison par localité (IMPLEMENTATION_TARIFS_LIVRAISON.md). `localite_nom`
  // est toujours renseigné (localité reconnue, lieu spécial, ou saisie libre) ;
  // `localite_id`/`lieu_special_id` restent null l'un de l'autre selon le cas.
  localite_id: number | null;
  lieu_special_id: number | null;
  localite_nom: string | null;
  // true = frais_livraison vaut 0 en attendant que l'admin confirme le tarif
  // réel (localité hors zone habituelle, non reconnue).
  frais_livraison_a_confirmer: boolean;
  // Message figé de la destination (lieu spécial ou groupe) : quand il est
  // présent, il s'affiche À LA PLACE du délai « 24h / 6j » (migration 0054).
  message_livraison: string | null;
  // Numéro de livraison normalisé, figé à la commande (migration 0056) : recopié
  // du client au moment de la commande, inchangé s'il corrige son profil ensuite.
  telephone_normalise: string | null;
};

export type CommandeItem = {
  id: number;
  commande_id: number;
  produit_id: number;
  variante_id: number | null;
  quantite: number;
  prix_unitaire: number;
  // Prix d'achat figé au moment de la vente (migration 0055) — base de la part
  // « reversé aux fournisseurs » du bénéfice. NULL si le produit n'avait pas de
  // prix d'achat renseigné.
  prix_achat_unitaire: number | null;
  // Date à laquelle le net vendeur de cette ligne a été reversé (migration 0032).
  // NULL = pas encore reversé.
  reverse_le: string | null;
};

// Suivi de trésorerie admin (GROUPE_B §2, migration 0032 ; catégories revues en
// 0055) : dépense saisie à la main. « Tout le reste » hors coût fournisseur.
export type CategorieDepense =
  | "livraison"
  | "wave"
  | "emballage"
  | "publicite"
  | "technique"
  | "autre";

export type Depense = {
  id: number;
  categorie: CategorieDepense;
  // Libellé obligatoire depuis 0055 (rétro-rempli depuis `note`).
  libelle: string;
  montant: number;
  date: string;
  note: string | null;
  commande_id: number | null;
  created_at: string;
};

// Marketplace V2 — comptes back-office. (id = auth.users.id)
export type Admin = {
  user_id: string;
  email: string | null;
  created_at: string;
};

// Vendeur = fournisseur (NOTE_UNIFICATION). Une seule entité qui fournit des
// produits. `user_id` NULL = vendeur géré par l'admin, sans compte de connexion
// (migration 0036). `adresse`/`lat`/`lng` = point de retrait de la marchandise.
export type Vendeur = {
  id: string;
  user_id: string | null;
  nom_boutique: string;
  contact_nom: string | null;
  contact_telephone: string | null;
  infos_reversement: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  actif: boolean;
  date_creation: string;
};

// Vue « fournisseur » de l'admin : un vendeur vu comme point de retrait de
// marchandise (écran /admin/fournisseurs, carte /admin/livraisons). Depuis
// l'unification (migration 0036) c'est une projection de `vendeurs`.
export type Fournisseur = {
  id: string;
  nom: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
};

// Demande de préparation adressée à un vendeur/fournisseur (migration 0038).
export type StatutDemandePreparation = "a_preparer" | "preparee";
export type DeclenchementPreparation = "manuel" | "auto_24h";

export type DemandePreparation = {
  id: number;
  vendeur_id: string;
  statut: StatutDemandePreparation;
  declenchement: DeclenchementPreparation;
  note: string | null;
  cree_le: string;
  preparee_le: string | null;
  // Récupérée par SacAdo (livreur passé chez le fournisseur) — migration 0039.
  recuperee_le: string | null;
};

export type DemandePreparationItem = {
  id: number;
  demande_id: number;
  commande_id: number;
  commande_item_id: number;
  produit_id: number | null;
  quantite: number;
  produit_nom: string;
  variante_label: string | null;
  produit_photo: string | null;
  client_nom: string;
  mode_livraison: string | null;
  zone_nom: string | null;
  note: string | null;
};

// Modèles de messages éditables (migration 0057). Une ligne par (code, canal).
export type CanalModele = "whatsapp" | "push" | "inbox";

export type ModeleMessage = {
  code: string;
  canal: CanalModele;
  libelle: string;
  titre: string | null;
  contenu: string;
  ordre: number;
  actif: boolean;
  maj_le: string;
};

// Préférences de notifications push du client (migration 0062). Absence de
// ligne = valeurs par défaut (tout activé) — voir lib/messages/preferences.ts.
export type PreferencesNotifications = {
  client_id: number;
  suivi_commandes: boolean;
  produits_attendus: boolean;
  rentree_nouveautes: boolean;
  maj_le: string;
};

// Journal des envois WhatsApp manuels (migration 0059).
export type EnvoiWhatsApp = {
  id: number;
  commande_id: number | null;
  client_id: number | null;
  telephone: string;
  code_modele: string | null;
  contenu_envoye: string;
  envoye_par: string | null;
  confirme: boolean;
  cree_le: string;
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
  // Destination au clic (migration 0058) : ex. `/suivi/42`. NULL = pas de lien.
  lien: string | null;
  // File des heures calmes (22h-7h Dakar, lot B4) : true = pas encore parti.
  envoi_differe: boolean;
};
