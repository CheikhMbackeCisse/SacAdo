import test from "node:test";
import assert from "node:assert/strict";
import { entrelacerAccueil, type ProfilFlux } from "./accueil-multi.ts";

type P = { id: number; sous_categorie_id: number | null };

function profil(
  source: "compte" | "beneficiaire",
  prenom: string | null,
  ids: number[],
  sc: (id: number) => number | null = (id) => id,
): ProfilFlux<P> {
  return {
    source,
    prenom,
    cartes: ids.map((id) => ({
      produit: { id, sous_categorie_id: sc(id) },
      origine: "score" as const,
    })),
  };
}

test("un seul profil : renvoie sa liste dans l'ordre, sans étiquette compte", () => {
  const r = entrelacerAccueil([profil("compte", null, [1, 2, 3, 4, 5])], 3);
  assert.deepEqual(r.map((c) => c.produit.id), [1, 2, 3]);
  assert.ok(r.every((c) => c.prenom === null));
});

test("deux enfants + compte : tour de rôle enfant1, enfant2, compte", () => {
  const r = entrelacerAccueil(
    [
      profil("compte", null, [100, 101, 102], () => 99),
      profil("beneficiaire", "Awa", [1, 2, 3], (id) => id),
      profil("beneficiaire", "Bou", [10, 11, 12], (id) => id),
    ],
    6,
  );
  assert.deepEqual(
    r.map((c) => ({ id: c.produit.id, prenom: c.prenom })),
    [
      { id: 1, prenom: "Awa" },
      { id: 10, prenom: "Bou" },
      { id: 100, prenom: null },
      { id: 2, prenom: "Awa" },
      { id: 11, prenom: "Bou" },
      { id: 101, prenom: null },
    ],
  );
});

test("jamais de doublon même si un produit est dans deux profils", () => {
  const r = entrelacerAccueil(
    [
      profil("compte", null, [1, 2, 3], () => 50),
      profil("beneficiaire", "Awa", [1, 4, 5], (id) => id),
    ],
    10,
  );
  const ids = r.map((c) => c.produit.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("quota global de 3 par sous-catégorie", () => {
  const r = entrelacerAccueil(
    [
      profil("beneficiaire", "Awa", [1, 2, 3, 4, 5, 6], () => 7), // tous même sous-cat
      profil("compte", null, [10, 11, 12], () => 8),
    ],
    10,
  );
  const memeSousCat = r.filter((c) => c.produit.sous_categorie_id === 7);
  assert.equal(memeSousCat.length, 3);
});

test("un profil épuisé n'empêche pas de remplir avec les autres", () => {
  const r = entrelacerAccueil(
    [
      profil("beneficiaire", "Awa", [1], (id) => id),
      profil("compte", null, [10, 11, 12, 13, 14], (id) => id),
    ],
    5,
  );
  assert.equal(r.length, 5);
  assert.deepEqual(r.map((c) => c.produit.id), [1, 10, 11, 12, 13]);
});
