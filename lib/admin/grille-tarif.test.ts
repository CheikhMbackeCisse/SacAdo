import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserGrille } from "./grille-tarif.ts";

// PROMPT_ADMIN_KITS_PRODUITS.md lot 3 : la page /admin/fournisseurs plantait
// car `grille_remise` contenait, pour Thioune Teranga, un objet
// {categorie: pourcentage} au lieu d'un tableau de paliers {seuil, valeur}.
test("normaliserGrille : un objet (pas un tableau) devient null, ne plante pas", () => {
  assert.equal(normaliserGrille({ Tablettes: 0.15, Accessoires: 0.3 }), null);
});

test("normaliserGrille : null et undefined restent null", () => {
  assert.equal(normaliserGrille(null), null);
  assert.equal(normaliserGrille(undefined), null);
});

test("normaliserGrille : un tableau de paliers valide passe tel quel", () => {
  const grille = [
    { seuil: 150000, valeur: 10000 },
    { seuil: null, valeur: 25000 },
  ];
  assert.deepEqual(normaliserGrille(grille), grille);
});

test("normaliserGrille : un tableau avec un élément mal formé devient null", () => {
  assert.equal(normaliserGrille([{ seuil: 1000, valeur: "10000" }]), null);
  assert.equal(normaliserGrille(["pas un palier"]), null);
});

test("normaliserGrille : tableau vide passe tel quel (grille vide valide)", () => {
  assert.deepEqual(normaliserGrille([]), []);
});
