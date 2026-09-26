# Modifications — chantier maj-26-09

Généré le 2026-09-26T16:22:00.301Z.

## En attente (bloqué techniquement, pas de choix éditorial)

- **Migration `supabase/migrations/0088_marques_collections.sql`** (colonne `produits.collection`) : à exécuter dans le SQL Editor Supabase — écriture DDL impossible sans accès direct à la base, uniquement via service_role (lecture/écriture de lignes).
- **`scripts/maj-26-09-section4-collections.mjs`** : prêt, écrit mais non exécuté (dépend de la migration ci-dessus). Tague 18 livres sur 5 collections identifiées avec confiance (La Clé des Cracks, Collection Kandia, Bled, Excellence, VISA Annales).
- **Pages marques + logos (code)** : faites (`/marques`, `/marques/[slug]`, logo sur carte/fiche produit, priorité dans la recherche) — indépendantes de la migration, déjà actives.
- **Pipeline images** : la chaîne WebP/redimensionnement/qualité existe déjà (upload vendeur/admin) et le service des vignettes 400/800px aussi (loader next/image). Le rattrapage de TOUTES les photos déjà en base (des milliers, tailles/formats hétérogènes) n'a pas été relancé dans ce chantier — gros job batch distinct, à faire à part.

## Section 1 — Corrections produit par produit

- **Règle plastique** ({"prix":100}) → `fait`
- **Cahier spirale 8 sujets A4** ({"prix":5500}) → `fait`
- **Cahier spirale orange** ({"prix":5500}) → `fait`
- **Calculatrice Casio fx-92 Collège Classwiz** ({"prix":8000}) → `fait`
- **Calculatrice Casio fx-92** (désambiguïsation) → `cas_douteux` — 2 correspondances par nom : #1592 (9000F, publié, choisi car prix identique à l'énoncé) et #16 (12000F, archivé, non touché).
- **Calculatrice TI-83 (images)** ({"photo":"https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/sacado/calculatrice-ti-83-premium-ce-python-1.webp","photos":["https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/sacado/calculatrice-ti-83-premium-ce-python-1.webp","https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/sacado/calculatrice-ti-83-premium-ce-python-2.webp"]}) → `fait`
- **Boîte à goûter ronde avec gourde (fusion galerie)** ({"photos":["https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/import-lpd/S024-2d10676d-150e-4c18-8371-88ddd439a683.webp","https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/import-lpd/S010-aaa99869-5e8a-47f3-934b-e131461167a0.webp"]}) → `fait`
- **Boîte à goûter avec gourde (doublon archivé -> redirige vers #1196)** ({"statut_publication":"archive","equivalent_id":1196}) → `fait`
- **Boîte à goûter ronde avec gourde** (fusion) → `cas_douteux` — Aucun des deux (#1182, #1196) n'a de commande/kit : hypothèse retenue faute de meilleur candidat, à confirmer.
- **Boîte à goûter rose avec gourde (3500F sans photo)** (suppression) → `supprime_reel`
- **Bouteille isotherme Vacuum Cup #1179** (suppression) → `supprime_reel`
- **Bouteille isotherme Vacuum Cup #1185** (suppression) → `supprime_reel`
- **Bouteille isotherme Vacuum Cup #1256** (suppression) → `supprime_reel`
- **Bouteille isotherme Vacuum Cup #1282** (suppression) → `supprime_reel`
- **Gourde inox SPORT noire** ({"prix":2800}) → `fait`
- **Gourde sport spray brumisateur** ({"prix":2800}) → `fait`
- **Brosse tableau blanc magnétique RX T-29** ({"prix":400}) → `fait`
- **Marqueur tableau blanc vert** ({"prix":500}) → `fait`
- **Présentoir correcteurs Igle -> Stylo correcteur Blanco Igle** ({"nom":"Stylo correcteur Blanco Igle","prix":400}) → `fait`
- **Porte-mines métal (lot) -> Porte-mines métal** ({"nom":"Porte-mines métal","prix":700}) → `fait`
- **Stylo Stitch 10 couleurs** ({"prix":3000}) → `fait`
- **Taille-crayon rond plastique -> Boîte à éponge (Fournitures d'école)** ({"nom":"Boîte à éponge","categorie_id":11}) → `fait`
- **Modem routeur Wi-Fi 4G LTE (image)** ({"photo":"https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/sacado/modem-routeur-4g-lte.webp","photos":["https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/sacado/modem-routeur-4g-lte.webp"]}) → `fait`
- **Bloc-notes Pupitre 160 pages A4 90g 5x5 spirale** ({"prix":5000}) → `fait`
- **Cahier de dessin (1050F)** ({"prix":550}) → `fait`
- **Cahier de dessin (1050 F)** (désambiguïsation) → `cas_douteux` — 2 correspondances au même prix (1050F) : #1297 'Cahier de dessin' (nom exact, choisi) et #1286 'Cahier de dessin TPG' (non touché).
- **Cahier Prestige B5 500 pages** ({"prix":4000}) → `fait`
- **Cahiers Socamel sans image** (correction orthographe) → `cas_douteux` — Aucun produit 'Socamel' en base ; trouvé sous 'Sokamel' (#1246, #1247), tous deux sans image -> supprimés.
- **Cahier Sokamel vert (sans image)** (suppression) → `supprime_reel`
- **Cahier Sokamel jaune décor (sans image)** (suppression) → `supprime_reel`
- **Protège-cahiers couleurs (lot) -> Protège-cahiers couleurs** ({"nom":"Protège-cahiers couleurs","prix":150}) → `fait`
- **De Tilène au Plateau** (remplacement image) → `ambigu` — 2 produits distincts portent ce titre : #1317 (LIT-017, 3500F) et #1417 (NIO-2896, 3900F). Image non appliquée, à trancher manuellement.
- **Découverte du monde C.I. (ajout image)** ({"photo":"https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/import-lpd/DID-6949-e04b270e-ecce-4b14-b4d9-141324683838.webp","photos":["https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/import-lpd/DID-6949-e04b270e-ecce-4b14-b4d9-141324683838.webp","https://yeklnsguhcmlinnufaog.supabase.co/storage/v1/object/public/produits/sacado/decouverte-du-monde-ci.webp"]}) → `fait`

## Section 2 — Stylos à l'unité (Staedtler, Bic)

- **Présentoir stylos Staedtler Stick 430 rouge (lot)** (suppression lot) → `supprime_reel`
- **Stylos Staedtler Stick 430 boîte de 10 bleu (lot)** (suppression lot) → `supprime_reel`
- **Stylos Staedtler Stick 430 boîte de 10 vert (lot)** (suppression lot) → `supprime_reel`
- **Stylos BIC Cristal Original 5 couleurs (lot)** (suppression lot) → `supprime_reel`
- **Stylo Staedtler Stick 430 M bleu** (creation) → `fait`
- **Stylo Staedtler Stick 430 M noir** (creation) → `fait`
- **Stylo Staedtler Stick 430 M rouge** (creation) → `fait`
- **Stylo Staedtler Stick 430 M vert** (creation) → `fait`
- **Pack de 4 stylos Staedtler Stick 430 M** (creation) → `fait`
- **Stylo Bic Cristal bleu** (creation) → `fait`
- **Stylo Bic Cristal noir** (creation) → `fait`
- **Stylo Bic Cristal rouge** (creation) → `fait`
- **Stylo Bic Cristal vert** (creation) → `fait`

## Section 3 — Nommage catalogue entier

- **Presentoir taille-crayons chiffres -> Taille-crayons chiffres** ({"nom":"Taille-crayons chiffres"}) → `fait`
- **Gommes Deli motif smiley (presentoir) -> sans le mot** ({"nom":"Gommes Deli motif smiley"}) → `fait`
- **Scan catalogue « présentoir »/« (lot) »** (audit) → `fait` — Seuls #1235 et #1212 restaient à corriger (prix < 1000F, renommés). Les autres correspondances '(lot)'/'lot de' du catalogue (pochettes, chasubles, hélices, capteurs, crayons couleur, cahiers vendus par 5...) sont de vrais lots multi-articles : non touchés, conformément à la consigne « ne supprime/renomme aucun autre produit vendu en lot ».
- **Lot de 5 Cahier Écolier 96P 17X22 70G Couverture Polypro -> Lot de 5 Cahier Écolier 96P petit format 70G Couverture Polypro** ({"nom":"Lot de 5 Cahier Écolier 96P petit format 70G Couverture Polypro","description":null}) → `fait`
- **Cahier 140P 17X22 90G Seyes Pp Bleu Calligraphe -> Cahier 140P petit format 90G Seyes Pp Bleu Calligraphe** ({"nom":"Cahier 140P petit format 90G Seyes Pp Bleu Calligraphe","description":null}) → `fait`
- **Cahier 140P 24X32 90G Seyes Pp Bleu Calligraphe -> Cahier 140P grand format 90G Seyes Pp Bleu Calligraphe** ({"nom":"Cahier 140P grand format 90G Seyes Pp Bleu Calligraphe","description":null}) → `fait`
- **Cahier 180P 17X22 70G Seyes Spirale Calligraphe -> Cahier 180P petit format 70G Seyes Spirale Calligraphe** ({"nom":"Cahier 180P petit format 70G Seyes Spirale Calligraphe","description":null}) → `fait`
- **Cahier 192P 17X22 70G Seyes Broche Calligraphe -> Cahier 192P petit format 70G Seyes Broche Calligraphe** ({"nom":"Cahier 192P petit format 70G Seyes Broche Calligraphe","description":null}) → `fait`
- **Cahier 192P 17X22 90G Seyes Pp Orange Calligraphe -> Cahier 192P petit format 90G Seyes Pp Orange Calligraphe** ({"nom":"Cahier 192P petit format 90G Seyes Pp Orange Calligraphe","description":null}) → `fait`
- **Cahier 96 pages 17X22 – 56g – seyès calligraphe -> Cahier 96 pages petit format – 56g – seyès calligraphe** ({"nom":"Cahier 96 pages petit format – 56g – seyès calligraphe","description":null}) → `fait`
- **Cahier 140P 24X32 90G Seyes Pp Jaune Calligraphe -> Cahier 140P grand format 90G Seyes Pp Jaune Calligraphe** ({"nom":"Cahier 140P grand format 90G Seyes Pp Jaune Calligraphe","description":null}) → `fait`
- **Cahier 140P 24X32 90G Seyes Pp Rouge Calligraphe -> Cahier 140P grand format 90G Seyes Pp Rouge Calligraphe** ({"nom":"Cahier 140P grand format 90G Seyes Pp Rouge Calligraphe","description":null}) → `fait`
- **Cahier 140P 24X32 90G Seyes Pp Transparent Calligraphe -> Cahier 140P grand format 90G Seyes Pp Transparent Calligraphe** ({"nom":"Cahier 140P grand format 90G Seyes Pp Transparent Calligraphe","description":null}) → `fait`
- **Cahier 140P 24X32 90G Seyes Pp Vert Calligraphe -> Cahier 140P grand format 90G Seyes Pp Vert Calligraphe** ({"nom":"Cahier 140P grand format 90G Seyes Pp Vert Calligraphe","description":null}) → `fait`
- **Cahier 192P 17X22 90G Seyes Pp Vert Calligraphe -> Cahier 192P petit format 90G Seyes Pp Vert Calligraphe** ({"nom":"Cahier 192P petit format 90G Seyes Pp Vert Calligraphe","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités PC 4eme -> Cahier d’activités PC 4eme** ({"nom":"Cahier d’activités PC 4eme","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités SVT 2nde -> Cahier d’activités SVT 2nde** ({"nom":"Cahier d’activités SVT 2nde","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités EDD CE1 -> Cahier d’activités EDD CE1** ({"nom":"Cahier d’activités EDD CE1","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités EDD CE2 -> Cahier d’activités EDD CE2** ({"nom":"Cahier d’activités EDD CE2","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités EDD CI -> Cahier d’activités EDD CI** ({"nom":"Cahier d’activités EDD CI","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités EDD CM1 -> Cahier d’activités EDD CM1** ({"nom":"Cahier d’activités EDD CM1","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités EDD CM2 -> Cahier d’activités EDD CM2** ({"nom":"Cahier d’activités EDD CM2","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités EDD CP -> Cahier d’activités EDD CP** ({"nom":"Cahier d’activités EDD CP","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités fongible LC C.E.1 -> Cahier d’activités fongible LC C.E.1** ({"nom":"Cahier d’activités fongible LC C.E.1","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités fongible LC C.E.2 -> Cahier d’activités fongible LC C.E.2** ({"nom":"Cahier d’activités fongible LC C.E.2","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités fongible LC C.I. -> Cahier d’activités fongible LC C.I.** ({"nom":"Cahier d’activités fongible LC C.I.","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités fongible LC C.M.1 -> Cahier d’activités fongible LC C.M.1** ({"nom":"Cahier d’activités fongible LC C.M.1","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités fongible LC C.M.2 -> Cahier d’activités fongible LC C.M.2** ({"nom":"Cahier d’activités fongible LC C.M.2","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités fongible LC C.P. -> Cahier d’activités fongible LC C.P.** ({"nom":"Cahier d’activités fongible LC C.P.","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités mathématiques C.E.1 -> Cahier d’activités mathématiques C.E.1** ({"nom":"Cahier d’activités mathématiques C.E.1","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités mathématiques C.E.2 -> Cahier d’activités mathématiques C.E.2** ({"nom":"Cahier d’activités mathématiques C.E.2","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités mathématiques C.I. -> Cahier d’activités mathématiques C.I.** ({"nom":"Cahier d’activités mathématiques C.I.","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités mathématiques C.M.1 -> Cahier d’activités mathématiques C.M.1** ({"nom":"Cahier d’activités mathématiques C.M.1","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités mathématiques C.M.2 -> Cahier d’activités mathématiques C.M.2** ({"nom":"Cahier d’activités mathématiques C.M.2","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités mathématiques C.P. -> Cahier d’activités mathématiques C.P.** ({"nom":"Cahier d’activités mathématiques C.P.","description":null}) → `fait`
- **Entités HTML décodées : Livre guide Découverte du monde C.I. &#8211; C.P. -> Livre guide Découverte du monde C.I. – C.P.** ({"nom":"Livre guide Découverte du monde C.I. – C.P.","description":null}) → `fait`
- **Entités HTML décodées : Production d&rsquo;écrits CM2 -> Production d’écrits CM2** ({"nom":"Production d’écrits CM2","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités PC 3éme -> Cahier d’activités PC 3éme** ({"nom":"Cahier d’activités PC 3éme","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités SVT 3éme -> Cahier d’activités SVT 3éme** ({"nom":"Cahier d’activités SVT 3éme","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités SVT 6éme -> Cahier d’activités SVT 6éme** ({"nom":"Cahier d’activités SVT 6éme","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités mathématiques 3éme -> Cahier d’activités mathématiques 3éme** ({"nom":"Cahier d’activités mathématiques 3éme","description":null}) → `fait`
- **Entités HTML décodées : Cahier d&rsquo;activités mathématiques 4éme -> Cahier d’activités mathématiques 4éme** ({"nom":"Cahier d’activités mathématiques 4éme","description":null}) → `fait`
- **Post-it : Post-it repositionnables couleurs** ({"nom":"Post-it repositionnables couleurs","mots_cles":"Papier et pochettes étiquettes"}) → `fait`
- **Post-it : Post-it Sticky Notes DHA** ({"nom":"Post-it Sticky Notes DHA","mots_cles":"Papier et pochettes étiquettes"}) → `fait`
- **Post-it : Post-it 75 x 75 mm Infonotes (100 feuilles)** ({"nom":"Post-it 75 x 75 mm Infonotes (100 feuilles)","mots_cles":"étiquettes"}) → `fait`
- **Post-it -> filtre Étiquettes** (mots_cles) → `cas_douteux` — Pas de table de rattachement multi-catégorie dans le schéma actuel (un produit n'a qu'une seule sous_categorie_id, et la déplacer vers 'Étiquettes' (sous cat. 11) les sortirait de Cahiers & papeterie). Choix : mot-clé 'étiquettes' ajouté à mots_cles pour qu'ils remontent en recherche/filtre par mot-clé, sans changer leur catégorie principale. #1690 'Petit bloc-notes vert et jaune' (1200F) est ambigu (ni 'spirale' ni 'repositionnable' dans le nom) : laissé en l'état, à trancher.

## Section 4 — Marques et collections

- **Champ marque** (remplissage) → `fait` — 14 produits mis à jour (hors Livres/Ebooks, jamais d'écrasement d'une marque déjà renseignée).
- **Champ collection (livres)** (remplissage) → `fait` — 20 livres tagués sur 5 collections identifiées avec confiance (nom exact ou alias confirmé des kits). Le reste du catalogue Livres (au-delà de ces éditions nommément identifiées) n'a pas été passé en revue individuellement : à compléter au fil de l'eau.

### Livres « La Clé des Cracks » (Korka Diallo) masqués

Aucun. Les 25 livres de Korka Diallo en base sont tous publiés, avec photo et prix.

## Section 5 — Catégories

- **Matériel géométrique -> Fournitures d'école** (fusion catégorie) → `fait` — 24 produits déplacés (dont calculatrices, non taguées « géométrie »). Catégorie 4 désactivée, jamais supprimée (garde l'historique).
- **Fusion « Fournitures scolaires »/« Fournitures d'école »** (verification) → `fait` — Une seule catégorie 'fournitures' existe en base : « Fournitures d'école » (id 11). Aucun doublon 'Fournitures scolaires' à fusionner — nom conservé : « Fournitures d'école ».
- **Bâtonnets et craies -> Fournitures d'école** (deplacement) → `cas_douteux` — #1230 'Craies grasses Giotto Cera 24' et #1259 'Craies de cire 12 couleurs' sont des craies grasses/de cire (pastels à l'huile, medium de coloriage proche des crayons de couleur), pas de la craie de tableau — déplacées à la lettre de la consigne, mais à confirmer : elles pourraient rester en Art & dessin. #1299/#1300 (Robercolor, boîte de 100) sont bien de la vraie craie de tableau, déplacement non ambigu.
- **Ordre d'affichage des catégories** (renumerotation) → `fait` — Fournitures d'école prend le rang 7 (celui de Matériel géométrique) ; les catégories suivantes se resserrent.

## Section 6 — Recherche, filtres, synonymes

- **Synonymes classes/matières/produits** (insertion) → `fait` — 68 nouveaux termes. Volontairement exclus : "pc" seul (collision avec ordinateurs, groupe 40/41), "l"/"l2"/"steg" seuls (déjà couverts par le filtre Série livres, trop courts/risqués en synonyme libre).
- **Matière Français (filtre livres)** (remplissage) → `fait` — 64/64 livres tagués (manuels de français/grammaire/conjugaison/Bled + oeuvres littéraires déjà cataloguées). 0 avaient déjà une autre matière, non écrasés.

## Cas douteux et ambigus (récapitulatif transverse)

- [§1] **Calculatrice Casio fx-92** : 2 correspondances par nom : #1592 (9000F, publié, choisi car prix identique à l'énoncé) et #16 (12000F, archivé, non touché).
- [§1] **Boîte à goûter ronde avec gourde** : Aucun des deux (#1182, #1196) n'a de commande/kit : hypothèse retenue faute de meilleur candidat, à confirmer.
- [§1] **Cahier de dessin (1050 F)** : 2 correspondances au même prix (1050F) : #1297 'Cahier de dessin' (nom exact, choisi) et #1286 'Cahier de dessin TPG' (non touché).
- [§1] **Cahiers Socamel sans image** : Aucun produit 'Socamel' en base ; trouvé sous 'Sokamel' (#1246, #1247), tous deux sans image -> supprimés.
- [§1] **De Tilène au Plateau** : 2 produits distincts portent ce titre : #1317 (LIT-017, 3500F) et #1417 (NIO-2896, 3900F). Image non appliquée, à trancher manuellement.
- [§3] **Post-it -> filtre Étiquettes** : Pas de table de rattachement multi-catégorie dans le schéma actuel (un produit n'a qu'une seule sous_categorie_id, et la déplacer vers 'Étiquettes' (sous cat. 11) les sortirait de Cahiers & papeterie). Choix : mot-clé 'étiquettes' ajouté à mots_cles pour qu'ils remontent en recherche/filtre par mot-clé, sans changer leur catégorie principale. #1690 'Petit bloc-notes vert et jaune' (1200F) est ambigu (ni 'spirale' ni 'repositionnable' dans le nom) : laissé en l'état, à trancher.
- [§5] **Bâtonnets et craies -> Fournitures d'école** : #1230 'Craies grasses Giotto Cera 24' et #1259 'Craies de cire 12 couleurs' sont des craies grasses/de cire (pastels à l'huile, medium de coloriage proche des crayons de couleur), pas de la craie de tableau — déplacées à la lettre de la consigne, mais à confirmer : elles pourraient rester en Art & dessin. #1299/#1300 (Robercolor, boîte de 100) sont bien de la vraie craie de tableau, déplacement non ambigu.

## Suppressions

- [§1] **Boîte à goûter rose avec gourde (3500F sans photo)** — suppression réelle
- [§1] **Bouteille isotherme Vacuum Cup #1179** — suppression réelle
- [§1] **Bouteille isotherme Vacuum Cup #1185** — suppression réelle
- [§1] **Bouteille isotherme Vacuum Cup #1256** — suppression réelle
- [§1] **Bouteille isotherme Vacuum Cup #1282** — suppression réelle
- [§1] **Cahier Sokamel vert (sans image)** — suppression réelle
- [§1] **Cahier Sokamel jaune décor (sans image)** — suppression réelle
- [§2] **Présentoir stylos Staedtler Stick 430 rouge (lot)** — suppression réelle
- [§2] **Stylos Staedtler Stick 430 boîte de 10 bleu (lot)** — suppression réelle
- [§2] **Stylos Staedtler Stick 430 boîte de 10 vert (lot)** — suppression réelle
- [§2] **Stylos BIC Cristal Original 5 couleurs (lot)** — suppression réelle

## Créations

- [§2] **Stylo Staedtler Stick 430 M bleu**
- [§2] **Stylo Staedtler Stick 430 M noir**
- [§2] **Stylo Staedtler Stick 430 M rouge**
- [§2] **Stylo Staedtler Stick 430 M vert**
- [§2] **Pack de 4 stylos Staedtler Stick 430 M**
- [§2] **Stylo Bic Cristal bleu**
- [§2] **Stylo Bic Cristal noir**
- [§2] **Stylo Bic Cristal rouge**
- [§2] **Stylo Bic Cristal vert**
