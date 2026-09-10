import test from "node:test";
import assert from "node:assert/strict";
import { assemblerAccueil, type LigneAccueil } from "./accueil-classement.ts";

// Générateur déterministe pour rendre le mélange reproductible dans les tests.
function aleaSeed(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function ligne(over: Partial<LigneAccueil> & { produit_id: number }): LigneAccueil {
  return {
    sous_categorie_id: over.produit_id % 7,
    score_final: 0.5,
    epingle_position: null,
    exploration_eligible: false,
    ...over,
  };
}

test("liste vide -> résultat vide", () => {
  assert.deepEqual(assemblerAccueil([], 20), []);
});

test("respecte la limite et l'ordre du score pour un catalogue simple", () => {
  const lignes = Array.from({ length: 40 }, (_, i) =>
    ligne({ produit_id: i + 1, score_final: 1 - i / 100 }),
  );
  const places = assemblerAccueil(lignes, 20, aleaSeed(1));
  assert.equal(places.length, 20);
  assert.equal(places[0].produitId, 1);
  assert.ok(places.every((p) => p.origine === "score"));
});

test("exactement 4 places d'exploration quand assez de produits éligibles", () => {
  const lignes = Array.from({ length: 30 }, (_, i) =>
    ligne({
      produit_id: i + 1,
      score_final: 1 - i / 100,
      // les 10 derniers sont éligibles à l'exploration
      exploration_eligible: i >= 20,
    }),
  );
  const places = assemblerAccueil(lignes, 20, aleaSeed(42));
  assert.equal(places.length, 20);
  assert.equal(places.filter((p) => p.origine === "exploration").length, 4);
  assert.equal(places.filter((p) => p.origine === "score").length, 16);
});

test("moins de 4 éligibles : on complète avec du score, sans trou", () => {
  const lignes = Array.from({ length: 25 }, (_, i) =>
    ligne({ produit_id: i + 1, score_final: 1 - i / 100, exploration_eligible: i === 24 }),
  );
  const places = assemblerAccueil(lignes, 20, aleaSeed(7));
  assert.equal(places.length, 20);
  assert.equal(places.filter((p) => p.origine === "exploration").length, 1);
  assert.equal(new Set(places.map((p) => p.produitId)).size, 20); // aucun doublon
});

test("un épinglé est placé à sa position et marqué 'epingle'", () => {
  const lignes = [
    ligne({ produit_id: 100, epingle_position: 3, score_final: 0.1 }),
    ...Array.from({ length: 25 }, (_, i) => ligne({ produit_id: i + 1, score_final: 1 - i / 100 })),
  ];
  const places = assemblerAccueil(lignes, 20, aleaSeed(3));
  assert.equal(places[2].produitId, 100);
  assert.equal(places[2].origine, "epingle");
  assert.equal(places.length, 20);
});

test("un produit épinglé n'apparaît jamais deux fois", () => {
  const lignes = [
    ligne({ produit_id: 5, epingle_position: 1, score_final: 0.9, exploration_eligible: true }),
    ...Array.from({ length: 25 }, (_, i) => ligne({ produit_id: i + 10, score_final: 1 - i / 100 })),
  ];
  const places = assemblerAccueil(lignes, 20, aleaSeed(9));
  assert.equal(places.filter((p) => p.produitId === 5).length, 1);
});
