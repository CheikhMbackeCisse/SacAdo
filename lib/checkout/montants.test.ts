import test from "node:test";
import assert from "node:assert/strict";
import { optionsPaiementPourTotal, paiementAutorise } from "./montants.ts";

test("pas de plafond : les deux modes sont toujours autorisés", () => {
  const petit = optionsPaiementPourTotal(5000);
  const gros = optionsPaiementPourTotal(500000);
  assert.equal(petit.waveImpose, false);
  assert.deepEqual(petit.options, ["livraison", "wave"]);
  assert.equal(gros.waveImpose, false);
  assert.deepEqual(gros.options, ["livraison", "wave"]);
});

test("sous le plafond : le client choisit entre livraison et Wave", () => {
  const r = optionsPaiementPourTotal(9999, true, 10000);
  assert.equal(r.waveImpose, false);
  assert.deepEqual(r.options, ["livraison", "wave"]);
});

test("pile au plafond : encore autorisé (strictement supérieur qui bascule)", () => {
  const r = optionsPaiementPourTotal(10000, true, 10000);
  assert.equal(r.waveImpose, false);
  assert.deepEqual(r.options, ["livraison", "wave"]);
});

test("au-dessus du plafond : Wave imposé", () => {
  const r = optionsPaiementPourTotal(10001, true, 10000);
  assert.equal(r.waveImpose, true);
  assert.deepEqual(r.options, ["wave"]);
});

test("paiementAutorise respecte le plafond", () => {
  assert.equal(paiementAutorise("livraison", 5000, true, 10000), true);
  assert.equal(paiementAutorise("wave", 5000, true, 10000), true);
  assert.equal(paiementAutorise("livraison", 12000, true, 10000), false);
  assert.equal(paiementAutorise("wave", 12000, true, 10000), true);
});

test("Wave non branché : livraison uniquement, quel que soit le montant ou le plafond", () => {
  const petit = optionsPaiementPourTotal(5000, false, 10000);
  const gros = optionsPaiementPourTotal(50000, false, 10000);
  assert.deepEqual(petit.options, ["livraison"]);
  assert.equal(gros.waveImpose, false);
  assert.deepEqual(gros.options, ["livraison"]);
  assert.equal(paiementAutorise("livraison", 50000, false, 10000), true);
  assert.equal(paiementAutorise("wave", 50000, false, 10000), false);
});
