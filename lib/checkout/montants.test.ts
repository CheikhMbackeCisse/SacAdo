import test from "node:test";
import assert from "node:assert/strict";
import {
  SEUIL_PAIEMENT_AVANCE,
  optionsPaiementPourTotal,
  paiementAutorise,
} from "./montants.ts";

test("sous le seuil : le client choisit entre livraison et Wave", () => {
  const r = optionsPaiementPourTotal(9999);
  assert.equal(r.waveImpose, false);
  assert.deepEqual(r.options, ["livraison", "wave"]);
});

test("pile au seuil (10 000) : Wave imposé", () => {
  const r = optionsPaiementPourTotal(SEUIL_PAIEMENT_AVANCE);
  assert.equal(r.waveImpose, true);
  assert.deepEqual(r.options, ["wave"]);
});

test("au-dessus du seuil : Wave imposé", () => {
  const r = optionsPaiementPourTotal(45000);
  assert.equal(r.waveImpose, true);
  assert.deepEqual(r.options, ["wave"]);
});

test("petit panier : les deux modes sont autorisés", () => {
  assert.equal(paiementAutorise("livraison", 5000), true);
  assert.equal(paiementAutorise("wave", 5000), true);
});

test("gros panier : la livraison n'est plus autorisée", () => {
  assert.equal(paiementAutorise("livraison", 12000), false);
  assert.equal(paiementAutorise("wave", 12000), true);
});

test("le seuil renvoyé correspond à la constante", () => {
  assert.equal(optionsPaiementPourTotal(0).seuil, SEUIL_PAIEMENT_AVANCE);
});

test("Wave non branché : livraison uniquement, quel que soit le montant", () => {
  const petit = optionsPaiementPourTotal(5000, false);
  const gros = optionsPaiementPourTotal(50000, false);
  assert.deepEqual(petit.options, ["livraison"]);
  assert.equal(gros.waveImpose, false);
  assert.deepEqual(gros.options, ["livraison"]);
  assert.equal(paiementAutorise("livraison", 50000, false), true);
  assert.equal(paiementAutorise("wave", 50000, false), false);
});
