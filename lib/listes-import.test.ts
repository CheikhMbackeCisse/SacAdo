import test from "node:test";
import assert from "node:assert/strict";
import { parserLigneImport, parserTexteImport } from "./listes-import.ts";

test("quantité en tête -> extraite, libellé nettoyé", () => {
  assert.deepEqual(parserLigneImport("6 cahiers de 200 pages"), {
    texteOriginal: "6 cahiers de 200 pages",
    libelle: "cahiers de 200 pages",
    quantite: 6,
  });
});

test("quantité en fin avec x -> extraite", () => {
  assert.deepEqual(parserLigneImport("Surligneurs x4"), {
    texteOriginal: "Surligneurs x4",
    libelle: "Surligneurs",
    quantite: 4,
  });
});

test("quantité entre parenthèses -> extraite", () => {
  assert.deepEqual(parserLigneImport("Gommes (2)"), {
    texteOriginal: "Gommes (2)",
    libelle: "Gommes",
    quantite: 2,
  });
});

test("puce et case à cocher -> retirées, pas une quantité", () => {
  assert.deepEqual(parserLigneImport("☐ Trousse"), {
    texteOriginal: "☐ Trousse",
    libelle: "Trousse",
    quantite: 1,
  });
  assert.deepEqual(parserLigneImport("- Règle de 30 cm"), {
    texteOriginal: "- Règle de 30 cm",
    libelle: "Règle de 30 cm",
    quantite: 1,
  });
});

test("numérotation de liste -> retirée, pas une quantité", () => {
  assert.deepEqual(parserLigneImport("1. Compas"), {
    texteOriginal: "1. Compas",
    libelle: "Compas",
    quantite: 1,
  });
});

test("ni puce ni quantité -> quantité par défaut 1", () => {
  assert.deepEqual(parserLigneImport("Équerre"), {
    texteOriginal: "Équerre",
    libelle: "Équerre",
    quantite: 1,
  });
});

test("ligne vide ou seulement une puce -> ignorée", () => {
  assert.equal(parserLigneImport(""), null);
  assert.equal(parserLigneImport("   "), null);
  assert.equal(parserLigneImport("-"), null);
});

test("quantité à 3 chiffres reconnue, au-delà ignorée (pas une quantité plausible)", () => {
  assert.equal(parserLigneImport("Ramette papier x999")?.quantite, 999);
  // 4 chiffres : aucune des deux regex de quantité ne capture un nombre aussi
  // long, la ligne entière reste le libellé avec quantité par défaut 1.
  const sansQuantite = parserLigneImport("Ramette papier x5000");
  assert.equal(sansQuantite?.quantite, 1);
  assert.equal(sansQuantite?.libelle, "Ramette papier x5000");
});

test("texte multi-lignes -> une ligne analysée par ligne non vide", () => {
  const resultat = parserTexteImport("6 cahiers de 200 pages\n\nSurligneurs x4\n☐ Trousse");
  assert.equal(resultat.length, 3);
  assert.equal(resultat[0].libelle, "cahiers de 200 pages");
  assert.equal(resultat[1].quantite, 4);
  assert.equal(resultat[2].libelle, "Trousse");
});
