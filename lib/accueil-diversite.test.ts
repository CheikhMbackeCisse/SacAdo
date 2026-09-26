import test from "node:test";
import assert from "node:assert/strict";
import { appliquerDiversite, ordonnerAccueil, type ProduitDiversite } from "./accueil-diversite.ts";

function p(
  id: number,
  over: Partial<ProduitDiversite> = {},
): ProduitDiversite {
  return { id, prix: 1000, categorie_id: null, sous_categorie_id: null, marque: null, editeur: null, ...over };
}

test("appliquerDiversite : pas plus de 2 consécutifs du même éditeur", () => {
  const produits = [
    p(1, { editeur: "Korka" }),
    p(2, { editeur: "Korka" }),
    p(3, { editeur: "Korka" }),
    p(4, { editeur: "Autre" }),
  ];
  const r = appliquerDiversite(produits);
  for (let i = 0; i < r.length - 2; i++) {
    const trois = r.slice(i, i + 3);
    const memeEditeur = trois.every((x) => x.editeur === trois[0].editeur && x.editeur !== null);
    assert.ok(!memeEditeur, `3 consécutifs du même éditeur à l'index ${i}`);
  }
  // Rien n'est perdu.
  assert.equal(r.length, produits.length);
});

test("appliquerDiversite : pas plus de 30% d'une section pour une même marque", () => {
  const produits = Array.from({ length: 10 }, (_, i) => p(i, { marque: i < 6 ? "Maped" : `Autre${i}` }));
  const r = appliquerDiversite(produits);
  const compteMaped = r.filter((x) => x.marque === "Maped").length;
  // Plafond = ceil(10 * 0.3) = 3, mais rien n'est perdu (report en fin de liste).
  assert.equal(r.length, produits.length);
  const dansLesTrentePourcent = r.slice(0, 3).filter((x) => x.marque === "Maped").length;
  assert.ok(dansLesTrentePourcent <= 3);
  assert.equal(compteMaped, 6); // aucun produit perdu, juste réordonné
});

test("ordonnerAccueil : kits/fournitures/cahiers/livres avant informatique", () => {
  const produits = [
    p(1, { categorie_id: 7, prix: 300000 }), // informatique cher
    p(2, { categorie_id: 6 }), // livres
    p(3, { categorie_id: 1 }), // kits
    p(4, { categorie_id: 7, prix: 100000 }), // informatique moins cher
    p(5, { categorie_id: 11 }), // fournitures
  ];
  const r = ordonnerAccueil(produits);
  const idsInformatiqueEnDernier = r.slice(-2).map((x) => x.id).sort();
  assert.deepEqual(idsInformatiqueEnDernier, [1, 4]);
  // Le moins cher des deux passe avant le plus cher.
  assert.equal(r[r.length - 2].id, 4);
  assert.equal(r[r.length - 1].id, 1);
  // Kits en tête.
  assert.equal(r[0].id, 3);
});
