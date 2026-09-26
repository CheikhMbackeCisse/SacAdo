# Rapport de résolution des références — kits scolaires

145 références au total (143 d'origine + 2 ajoutées avec le fondateur pour le kit 3e Confort, voir plus bas). Résolution vérifiée sur les 1706 produits de la base (pagination complète — une première passe limitée à 1000 lignes par défaut avait été corrigée avant ce comptage final).

- Trouvées : 139
- Ambiguës : 0
- Introuvables (aucun livre disponible pour ce niveau/cette matière, sans doublon avec un manuel déjà dans le kit) : 6

## Résolues via la collection « Cracks / Clé du Bac » (naming différent selon le niveau)
Le fondateur confirme que la collection s'appelle « La Clé des Cracks » pour le collège/lycée et « La Clé du Bac » en Terminale, du même auteur (Korka Diallo). En cherchant par `editeur ILIKE '%cracks%'` en plus du nom exact, 3 références de plus se résolvent sans ambiguïté (même collection, éditeur explicite) :
- CDC-2M — Mathématiques Seconde S → #43 « KAAMILE DE MATHS - SECONDE S » (Collection Cracks / Londo, 10 000 F)
- CDC-2PC — Sciences physiques Seconde S → #44 « PHYSIQUE CHIMIE SECONDE S » (Collection Cracks / Londo, 10 000 F)
- CDC-TM — Mathématiques Terminale S → #63 « MATHS TS2 - LA CLE DU BAC » (Collection Cracks, Terminale S2, 10 000 F — édition S2 retenue comme pour CDC-1M)

## Kit 3e Confort : ajustement décidé avec le fondateur
CDC-3PC (La Clé des Cracks Physique-Chimie 3e) n'a pas d'édition dans ce catalogue. Le fondateur a demandé de le remplacer par un livre réellement en stock et d'ajouter une SVT qui manquait à ce kit :
- Ligne CDC-3PC renommée en **KANDIA-3PC**, résolue vers **#1338 « Collection Kandia - Physique Chimie 3ème »** (Niokobok, 4 000 F).
- Nouvelle ligne **LACLE-3SVT** ajoutée au kit 3e Confort, résolue vers **#41 « SVT TROISIEME COLLEGE »** (Collection La Clé, 10 000 F) — cette matière n'était pas dans les 143 références d'origine.
- CDC-3M (Maths 3e) reste sans substitut demandé — toujours introuvable, ligne non créée pour ce kit.

## Recherche Didactikos (à la demande du fondateur) — résultat mitigé, une duplication détectée
Le fondateur a demandé d'utiliser les livres Didactikos de chaque classe pour remplacer les CDC-* introuvables, quand disponibles. Vérification faite : la base contient une grosse collection Didactikos (59 références DID-* déjà utilisées dans kits.json comme « Manuels au programme »). Mais pour les niveaux/matières qui nous intéressent ici, le seul livre Didactikos disponible **est déjà la ligne « manuel au programme » du même kit** :
- CDC-3M (Maths 3e) → seul candidat Didactikos : `DID-7432` (#1558, Mathématiques 3ème) — **déjà présent** dans kit-3e-complet ET kit-3e-confort comme manuel au programme. L'ajouter une 2e fois en « Parascolaire scientifique » ferait acheter 2 fois le même livre.
- CDC-1SVT (SVT Première S) → seul candidat Didactikos : `DID-7941` (#1562) — **déjà présent** comme manuel au programme dans les 6 kits Première (L et S, Essentiel/Complet/Confort).
- CDC-TSVT (SVT Terminale S) → seul candidat Didactikos : `DID-8376` (#1561) — **déjà présent** comme manuel au programme dans les 6 kits Terminale (L et S).
- CDC-2SVT (SVT Seconde S), CDC-1PC (Physique Première S), CDC-TPC (Physique Terminale S) : **aucun livre Didactikos** n'existe pour ces niveaux/matières précis (vérifié dans la collection complète Éditions Didactikos, 41 titres).

**Je n'ai rien changé pour ces 6-là** en attendant ton avis : vu qu'utiliser Didactikos créerait un doublon pour 3 d'entre elles (le même livre compté 2 fois dans le kit), je préfère te demander avant d'agir plutôt que de deviner.

## Résolus aujourd'hui (actions réelles en base, sur tes instructions)
- **A-CREER-01** (Cahier Calligraphe 192/200 pages grand format) : photo fournie par le fondateur. #1237 (vert, existant) repassé de 2050/1750 à **1600/1300** F ; nouveau produit **#1715** (orange, 1600/1300 F, photo uploadée) créé et publié. Résolution par défaut vers #1237.
- **A-CREER-02** (Cahier Calligraphe 96 pages grand format) : confirmé absent (n'existe qu'en petit format 17x22). Sur instruction du fondateur, les 24 lignes concernées (12 kits Seconde/Première/Terminale L et S, Complet et Confort) ont été **remplacées par `SAC-048`** (Cahier 96 pages 17x22 Calligraphe, #1618, petit format), avec le libellé corrigé « petit format » au lieu de « grand format ».
- **A-CREER-03** (copies doubles) : créé en base, masqué (`statut_publication=en_attente`), **sans photo** (à fournir plus tard) — **#1716**, 1800/1300 F, `reference_fournisseur=A-CREER-03` pour une résolution automatique au script d'import.

## Vérification catalogue Korka Diallo (à la demande du fondateur)
Le fondateur pensait qu'une erreur d'import avait pu laisser des titres Korka Diallo de côté. Vérification faite : les 41 titres de `SacAdo_Livres_Korka_Diallo.xlsx` (fichier original de l'intégration, `TACHE_livres_korka_integration.md`) sont **tous** présents en base par titre exact. **Aucun titre manquant, aucune erreur d'import.** Les 6 références CDC-* encore introuvables (CDC-3M, CDC-2SVT, CDC-1SVT, CDC-1PC, CDC-TPC, CDC-TSVT) ne sont donc pas un import raté : ce sont simplement des ouvrages qui n'existent pas dans ce catalogue sous la collection « Cracks »/« Clé du Bac », ni (pour 3 d'entre elles) sous une édition Didactikos distincte du manuel déjà inclus (voir section dédiée ci-dessus).

## Cas particuliers résolus manuellement
- S065 (crayon) : la référence exacte pointe vers le pack de 12 (#1236, 600 FCFA). La consigne demande la variante à l'unité — trouvée séparément sous la référence `S065-UNITE` (#1571, 75 FCFA/unité). C'est celle-ci qui est utilisée.
- CIS-ardoise : la référence réelle en base est `ardoise-quadrillee` (#1714), avec 4 variantes couleur (rouge #76, orange #77, bleue #78, verte #79), même prix. Sur la page du kit, le client pourra choisir sa couleur (voir « sélection de variante » dans le plan) plutôt qu'une variante imposée par défaut.

## Écarts de prix > 50 % vs classeur
(aucun)

## Détail complet (143 lignes)

| Référence | Nom attendu | Fournisseur | Prix classeur | Produit trouvé | Méthode | Écart prix | Note |
|---|---|---|---|---|---|---|---|
| SAC-001 | Cahier de dessin L'écolier 32 pages | Papex | 250 | #1572 — Cahier de dessin L'écolier 32 pages — 250 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-004 | Cahier L'écolier 48 pages | Papex | 275 | #1575 — Cahier L'écolier 48 pages — 275 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-005 | Cahier L'écolier 192 pages | Papex | 500 | #1576 — Cahier L'écolier 192 pages — 500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-048 | Cahier Calligraphe 96 pages 17x22 56 g seyès | Papex | 450 | #1618 — Cahier 96 pages 17X22 – 56g – seyès calligraphe — 450 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-033 | Cahier Calligraphe 140 pages 17x22 90 g seyès | Papex | 750 | #1603 — Cahier 140P 17X22 90G Seyes Pp Bleu Calligraphe — 750 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-046 | Cahier Calligraphe 192 pages 17x22 90 g seyès | Papex | 900 | #1616 — Cahier 192P 17X22 90G Seyes Pp Orange Calligraphe — 900 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-036 | Cahier Calligraphe 140 pages 24x32 90 g seyès | Papex | 1500 | #1606 — Cahier 140P 24X32 90G Seyes Pp Bleu Calligraphe — 1500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| A-CREER-01 | Cahier Calligraphe 192 pages 24x32 (grand format) | Papex | 1650 | #1715 — Cahier Calligraphe 200 pages grand format - Orange — 1600 FCFA — dispo/publie | ajout manuel (photo fournie par le fondateur) |  | Voir section dédiée plus haut |
| A-CREER-02 | Cahier Calligraphe 96 pages 24x32 (grand format) | Papex | 1350 | INTROUVABLE | recherche Calligraphe grand format (introuvable — la consigne dit "déjà dans l'app", contredit par la base) |  |  |
| A-CREER-03 | Paquet de copies doubles grand format | À préciser | 1800 | INTROUVABLE | recherche « copies doubles » (introuvable, à créer) |  |  |
| CDC-3M | La Clé des Cracks : Mathématiques 3e | Multilivre | - | INTROUVABLE | recherche « Clé des Cracks » (aucune édition trouvée) |  |  |
| CDC-3PC | La Clé des Cracks : Sciences physiques 3e | Multilivre | - | INTROUVABLE | recherche « Clé des Cracks » (aucune édition trouvée) |  |  |
| CDC-2M | La Clé des Cracks : Mathématiques Seconde S | Multilivre | - | #43 — KAAMILE DE MATHS - SECONDE S — 10000 FCFA — dispo/publie | editeur ILIKE cracks |  |  |
| CDC-2PC | La Clé des Cracks : Sciences physiques Seconde S | Multilivre | - | #44 — PHYSIQUE CHIMIE SECONDE S — 10000 FCFA — dispo/publie | editeur ILIKE cracks |  |  |
| CDC-2SVT | La Clé des Cracks : SVT Seconde S | Multilivre | - | INTROUVABLE | recherche « Clé des Cracks » (aucune édition trouvée) |  |  |
| CDC-1SVT | La Clé des Cracks : SVT Première S | Multilivre | - | INTROUVABLE | recherche « Clé des Cracks » (aucune édition trouvée) |  |  |
| CDC-1M | La Clé des Cracks : Mathématiques Première S (S1 ou S2) | Multilivre | - | #50 — MATHS 1S2 - LA CLE DES CRACKS — 6000 FCFA — dispo/publie | nom (édition S2 retenue sur consigne, S1 #47 existe aussi) |  | Édition S1 (#47) également présente en base — S2 retenue par consigne. |
| CDC-1PC | La Clé des Cracks : Sciences physiques Première S | Multilivre | - | INTROUVABLE | recherche « Clé des Cracks » (aucune édition trouvée) |  |  |
| CDC-TM | La Clé des Cracks : Mathématiques Terminale S | Multilivre | - | #63 — MATHS TS2 - LA CLE DU BAC — 10000 FCFA — dispo/publie | nom (édition S2, « Clé du Bac » = même collection en Terminale) |  |  |
| CDC-TPC | La Clé des Cracks : Sciences physiques Terminale S | Multilivre | - | INTROUVABLE | recherche « Clé des Cracks » (aucune édition trouvée) |  |  |
| CDC-TSVT | La Clé des Cracks : SVT Terminale S | Multilivre | - | INTROUVABLE | recherche « Clé des Cracks » (aucune édition trouvée) |  |  |
| SAC-007 | Kit de traçage 30 cm, 4 pièces L'écolier | Papex | 900 | #1578 — Kit de traçage 30 cm, 4 pièces — 900 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-019 | Crayons de couleur Maped, boîte de 12 | Papex | 900 | #1589 — Crayon Couleur BTE X12 – MAPED — 900 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-024 | Crayons de couleur Maped Nightfall, boîte de 24 | Papex | 1600 | #1594 — Crayons de Couleur Boite de 24 Nightfall – MAPED — 1600 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-065 | Stylo à bille Schneider Tops 505 M bleu | Papex | 100 | #1635 — Stylo à bille tops 505m Schneider (Couleur: Bleu) — 100 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-104 | Stylo à bille Schneider Tops 505 M vert | Papex | 100 | #1674 — Stylo à bille tops 505m Schneider (Couleur: Vert) — 100 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-066 | Pack de 4 stylos Schneider Tops 505 M (bleu, noir, rouge, vert) | Papex | 400 | #1636 — Pack de 4 stylos à bille Schneider Tops 505 M (bleu, noir, rouge, vert) — 400 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-062 | Stylo 4 couleurs Schneider | Papex | 1750 | #1632 — Stylo 4 Couleurs SCHNEIDER Blanc et Bleu — 1750 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-017 | Taille-crayon avec réservoir Maped | Papex | 500 | #1587 — Tailla Crayon 1 Trou + Réservoir Clean – MAPED — 500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-031 | Bâton de colle Giotto 10 g | Papex | 500 | #1601 — Bâton de colle 10 g – GIOTTO — 600 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-034 | Bâton de colle Giotto 20 g | Papex | 900 | #1604 — Bâton de colle 20 g – GIOTTO — 700 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-016 | Ciseaux Maped 13 cm Security | Papex | 900 | #1586 — Ciseaux 13cm Security Stop – MAPED — 900 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-041 | Compas Maped | Papex | 2000 | #1611 — Compas – MAPED — 2000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-037 | Surligneurs Maped Fluo Peps, pochette de 4 | Papex | 2500 | #1607 — Fluo Peps Surligneurs classiques, couleurs assorties – pack de 4 – MAPED — 2500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-069 | Correcteur souris ARK | Papex | 1000 | #1639 — Blanco souris – Correction tape – ARK — 1000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-055 | Chemise 3 rabats à élastique | Papex | 500 | #1625 — Chemise. 3 rabats élastiques + étiquettes 4,5/10ème assorties — 500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-022 | Calculatrice Casio fx-92 Collège | Papex | 9000 | #1592 — Calculatrice Casio fx-92 Collège Classwiz — 9000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| SAC-112 | Dictionnaire Le Robert de français, 65 000 mots | Papex | 3500 | #1682 — Le Robert dictionnaire de français 65 000 mots — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S011 | Règle plastique transparente 20 cm | LPD | 300 | #1183 — Regle plastique transparente 20 cm — 300 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S069 | Règle métal 30 cm | LPD | 550 | #1240 — Regle metal 30 cm — 550 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S086 | Ardoise scolaire | LPD | 900 | #1255 — Ardoise scolaire rouge — 900 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S053 | Éponge | LPD | 1500 | #1224 — Eponge Expanding Sponge — 1500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S065 | Crayon papier (vendu à l'unité) | LPD | 75 | #1571 — Crayon papier couleur du Senegal - a l unite — 75 FCFA — dispo/publie | recherche (variante unité, pas le pack de 12) |  |  |
| S009 | Gomme Staedtler Mars Plastic | LPD | 250 | #1181 — Gomme Staedtler Mars Plastic — 250 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S030 | Taille-crayon rond plastique | LPD | 250 | #1202 — Taille-crayon rond plastique — 250 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S081 | Ciseaux scolaires bouts ronds | LPD | 250 | #1250 — Ciseaux scolaires bouts ronds — 250 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S033 | Compas de précision avec étui | LPD | 600 | #1205 — Compas de precision avec etui — 600 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S091 | Kit géométrie Maped 30 cm (réf. 1930) | LPD | 1800 | #1260 — Kit geometrie Maped ref 1930 30 cm — 1800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S015 | Calculatrice scientifique Parpn YH-2000 | LPD | 1400 | #1187 — Calculatrice scientifique Parpn YH-2000 — 1400 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S100 | Protège-documents porte-vues | LPD | 1150 | #1269 — Protege-documents porte-vues couleurs — 1150 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S129 | Cahier de dessin TPG | LPD | 1050 | #1286 — Cahier de dessin TPG — 1050 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| CIS-ardoise | Ardoise quadrillée avec poignée | Cissé & Frères | 2500 | #1714 — Ardoise quadrillée — 2500 FCFA — dispo/publie | recherche (référence réelle en base) |  |  |
| LIT-014 | Le Pagne noir (Bernard Dadié) | LPD | 3500 | #1314 — Le Pagne noir — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-011 | Les Contes d'Amadou Koumba (Birago Diop) | LPD | 3500 | #1311 — Les Contes d Amadou Koumba — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-021 | La Belle Histoire de Leuk-le-Lièvre (Senghor et Sadji) | LPD | 3500 | #1321 — La belle histoire de Leuk-le-Lievre — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-023 | L'Os de Mor Lam (Birago Diop) | LPD | 3500 | #1323 — L Os de Mor Lam — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-018 | Le Malade imaginaire (Molière) | LPD | 2800 | #1318 — Le Malade imaginaire — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-013 | Sous l'orage (Seydou Badian) | LPD | 3500 | #1313 — Sous l orage — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-2900 | Eugénie Grandet (Balzac) | LPD | 3900 | #1419 — Eugénie Grandet — 3900 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-001 | Une si longue lettre (Mariama Bâ) | LPD | 3500 | #1301 — Une si longue lettre — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-019 | Vol de nuit (Saint-Exupéry) | LPD | 2800 | #1319 — Vol de nuit — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-6379 | Les Nouveaux Contes d'Amadou Koumba (Birago Diop) | LPD | 3900 | #1427 — Les nouveaux contes d'Amadou Koumba — 3900 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S062 | Le Marabout de la sécheresse (Cheik Aliou Ndao) | LPD | 2800 | #1233 — Le marabout de la secheresse - Cheick Aliou Ndao — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-004 | L'Enfant noir (Camara Laye) | LPD | 2800 | #1304 — L Enfant noir — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-024 | Une vie de boy (Ferdinand Oyono) | LPD | 2800 | #1324 — Une vie de boy — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-008 | Le Père Goriot (Balzac) | LPD | 2800 | #1308 — Le Pere Goriot — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-009 | Madame Bovary (Flaubert) | LPD | 2800 | #1309 — Madame Bovary — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-005 | Les Bouts de bois de Dieu (Ousmane Sembène) | LPD | 3500 | #1305 — Les Bouts de bois de Dieu — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-003 | Nini, mulâtresse du Sénégal (Abdoulaye Sadji) | LPD | 3500 | #1303 — Nini, mulatresse du Senegal — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-007 | L'Étranger (Albert Camus) | LPD | 2800 | #1307 — L Etranger — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-010 | Les Contemplations (Victor Hugo) | LPD | 2800 | #1310 — Les Contemplations — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-002 | L'Aventure ambiguë (Cheikh Hamidou Kane) | LPD | 3500 | #1302 — L Aventure ambigue — 3500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| LIT-020 | Apologie de Socrate (Platon) | LPD | 2800 | #1320 — Apologie de Socrate — 2800 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6913 | Langue et communication C.I. | LPD | 3890 | #1507 — Langue et communication C.I. — 3890 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6936 | Mathématiques C.I. | LPD | 3890 | #1520 — Mathématiques C.I. — 3890 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6949 | Découverte du monde C.I. | LPD | 3890 | #1488 — Découverte du monde C.I. — 3890 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6915 | Langue et communication C.P. | LPD | 3890 | #1510 — Langue et communication C.P. — 3890 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6938 | Mathématiques C.P. | LPD | 3890 | #1523 — Mathématiques C.P. — 3890 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6952 | Découverte du monde C.P. | LPD | 3890 | #1491 — Découverte du monde C.P. — 3890 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6917 | Langue et communication C.E.1 | LPD | 4000 | #1505 — Langue et communication C.E.1 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6941 | Mathématiques C.E.1 | LPD | 4000 | #1518 — Mathématiques C.E.1 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6954 | Découverte du monde C.E.1 | LPD | 4000 | #1486 — Découverte du monde C.E.1 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6922 | Langue et communication C.E.2 | LPD | 4000 | #1506 — Langue et communication C.E.2 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6943 | Mathématiques C.E.2 | LPD | 4000 | #1519 — Mathématiques C.E.2 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6956 | Découverte du monde C.E.2 | LPD | 4000 | #1487 — Découverte du monde C.E.2 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6924 | Langue et communication C.M.1 | LPD | 4000 | #1508 — Langue et communication C.M.1 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6945 | Mathématiques C.M.1 | LPD | 4000 | #1521 — Mathématiques C.M.1 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6958 | Découverte du monde C.M.1 | LPD | 4000 | #1489 — Découverte du monde C.M.1 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6927 | Langue et communication C.M.2 | LPD | 4000 | #1509 — Langue et communication C.M.2 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6947 | Mathématiques C.M.2 | LPD | 4000 | #1522 — Mathématiques C.M.2 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-6963 | Découverte du monde C.M.2 | LPD | 4000 | #1490 — Découverte du monde C.M.2 — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7364 | Cahier d’activités fongible LC C.I. | LPD | 2790 | #1465 — Cahier d&rsquo;activités fongible LC C.I. — 2790 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7253 | Cahier d’activités mathématiques C.I. | LPD | 2790 | #1471 — Cahier d&rsquo;activités mathématiques C.I. — 2790 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7404 | Cahier d’activités fongible LC C.P. | LPD | 2790 | #1468 — Cahier d&rsquo;activités fongible LC C.P. — 2790 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7248 | Cahier d’activités mathématiques C.P. | LPD | 2790 | #1474 — Cahier d&rsquo;activités mathématiques C.P. — 2790 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7403 | Cahier d’activités fongible LC C.E.1 | LPD | 3010 | #1463 — Cahier d&rsquo;activités fongible LC C.E.1 — 3010 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7246 | Cahier d’activités mathématiques C.E.1 | LPD | 3010 | #1469 — Cahier d&rsquo;activités mathématiques C.E.1 — 3010 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7256 | Cahier d’activités fongible LC C.E.2 | LPD | 3010 | #1464 — Cahier d&rsquo;activités fongible LC C.E.2 — 3010 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7241 | Cahier d’activités mathématiques C.E.2 | LPD | 3010 | #1470 — Cahier d&rsquo;activités mathématiques C.E.2 — 3010 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7259 | Cahier d’activités fongible LC C.M.1 | LPD | 3240 | #1466 — Cahier d&rsquo;activités fongible LC C.M.1 — 3240 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7239 | Cahier d’activités mathématiques C.M.1 | LPD | 3240 | #1472 — Cahier d&rsquo;activités mathématiques C.M.1 — 3240 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7017 | VISA Annales CFEE | LPD | 4650 | #1569 — VISA Annales CFEE — 4650 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-3240 | Bled CM2-6e | LPD | 4500 | #1336 — Bled CM2-6e — 4500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7469 | Mathématiques 6éme | LPD | 3960 | #1560 — Mathématiques 6éme — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7467 | Science de la vie et de la terre 6éme | LPD | 3960 | #1566 — Science de la vie et de la terre 6éme — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-2894 | Grammaire du Français 6/5e, IPAM Edicef | LPD | 4000 | #1351 — Grammaire du Français 6/5e, IPAM Edicef — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-2907 | Excellence Maths 6ème, EENAS | LPD | 4000 | #1345 — Excellence Maths 6ème, EENAS — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7947 | Cahier d’activités maths 6éme | LPD | 3130 | #1547 — Cahier d’activités maths 6éme — 3130 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7471 | Cahier d’activités SVT 6éme | LPD | 3430 | #1540 — Cahier d&rsquo;activités SVT 6éme — 3430 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-8096 | Mathématiques 5éme | LPD | 3960 | #1559 — Mathématiques 5éme — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7465 | Science de la vie et de la terre 5éme | LPD | 3960 | #1565 — Science de la vie et de la terre 5éme — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-3008 | Le Français en 5ème | LPD | 4000 | #1363 — Le Français en 5ème — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-2908 | Excellence Maths 5ème, EENAS | LPD | 4000 | #1344 — Excellence Maths 5ème, EENAS — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7950 | Cahier d’activités maths 5éme | LPD | 3130 | #1546 — Cahier d’activités maths 5éme — 3130 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-8098 | Cahier d’activités SVT 5éme | LPD | 3430 | #1545 — Cahier d’activités SVT 5éme — 3430 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7456 | Mathématiques 4eme | LPD | 3960 | #1445 — Mathématiques 4eme — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7454 | Science de la vie et de la terre 4éme | LPD | 3960 | #1564 — Science de la vie et de la terre 4éme — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7459 | Sciences physiques 4éme | LPD | 3960 | #1567 — Sciences physiques 4éme — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-2895 | Grammaire du Français 4/3e, IPAM Edicef | LPD | 4000 | #1350 — Grammaire du Français 4/3e, IPAM Edicef — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-2909 | Excellence Maths 4ème, EENAS | LPD | 4000 | #1343 — Excellence Maths 4ème, EENAS — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7461 | Cahier d’activités mathématiques 4éme | LPD | 3130 | #1542 — Cahier d&rsquo;activités mathématiques 4éme — 3130 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-8287 | Cahier d’activités SVT 4éme | LPD | 3430 | #1544 — Cahier d’activités SVT 4éme — 3430 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7463 | Cahier d’activités PC 4eme | LPD | 3130 | #1440 — Cahier d&rsquo;activités PC 4eme — 3130 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7432 | Mathématiques 3éme | LPD | 3960 | #1558 — Mathématiques 3éme — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7434 | Science de la vie et de la terre 3éme | LPD | 3960 | #1563 — Science de la vie et de la terre 3éme — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7422 | Sciences Physiques 3ème | LPD | 3960 | #1446 — Sciences Physiques 3ème — 3960 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-5189 | Le Français en 3ème | LPD | 4000 | #1362 — Le Français en 3ème — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| NIO-2910 | Excellence Maths 3ème, EENAS | LPD | 4000 | #1342 — Excellence Maths 3ème, EENAS — 4000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7427 | Cahier d’activités mathématiques 3éme | LPD | 3130 | #1541 — Cahier d&rsquo;activités mathématiques 3éme — 3130 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7452 | Cahier d’activités SVT 3éme | LPD | 3430 | #1539 — Cahier d&rsquo;activités SVT 3éme — 3430 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7430 | Cahier d’activités PC 3éme | LPD | 3130 | #1538 — Cahier d&rsquo;activités PC 3éme — 3130 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7944 | Science de la vie et de la terre 2nde | LPD | 4720 | #1450 — Science de la vie et de la terre 2nde — 4720 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-9328 | Cahier d’activités SVT 2nde | LPD | 3660 | #1447 — Cahier d&rsquo;activités SVT 2nde — 3660 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-9284 | Mathématiques 2nde | LPD | 4720 | #1449 — Mathématiques 2nde — 4720 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-8383 | Livre de Français 2nde | LPD | 4720 | #1448 — Livre de Français 2nde — 4720 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-7941 | Science de la vie et de la terre 1ʳᵉ | LPD | 4720 | #1562 — Science de la vie et de la terre 1ʳᵉ — 4720 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-9285 | Livre de Mathématiques 1ʳᵉ | LPD | 4720 | #1551 — Livre de Mathématiques 1ʳᵉ — 4720 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-8378 | Livre de Français 1ʳᵉ | LPD | 4720 | #1549 — Livre de Français 1ʳᵉ — 4720 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-8376 | Science de la Vie et de la Terre Tlᵉ | LPD | 4720 | #1561 — Science de la Vie et de la Terre Tlᵉ — 4720 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-9286 | Livre de Mathématiques Tlᵉ | LPD | 4720 | #1552 — Livre de Mathématiques Tlᵉ — 4720 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| DID-8385 | Livre de Français Tlᵉ | LPD | 4720 | #1550 — Livre de Français Tlᵉ — 4720 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S027 | Cartable rigide bleu marine | LPD | 7500 | #1199 — Cartable rigide bleu marine — 7500 FCFA — dispo/publie | reference_fournisseur exacte |  |  |
| S020 | Sac à dos bleu marine | LPD | 7000 | #1192 — Sac a dos bleu marine — 7000 FCFA — dispo/publie | reference_fournisseur exacte |  |  |