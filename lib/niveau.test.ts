import test from "node:test";
import assert from "node:assert/strict";
import {
  tokensNiveau,
  encoderNiveau,
  decoderNiveau,
  cycleDeNiveau,
  classeComplete,
} from "./niveau.ts";

test("lycée avec série : base + lettre de série + cycle", () => {
  assert.deepEqual(tokensNiveau("Terminale S1", "lycee"), ["Terminale", "S", "lycee"]);
  assert.deepEqual(tokensNiveau("Première L2", "lycee"), ["Première", "L", "lycee"]);
});

test("collège / élémentaire : classe entière + cycle", () => {
  assert.deepEqual(tokensNiveau("6e", "college"), ["6e", "college"]);
  assert.deepEqual(tokensNiveau("CP", "elementaire"), ["CP", "elementaire"]);
});

test("préscolaire (deux mots, pas une série) : classe entière", () => {
  assert.deepEqual(tokensNiveau("Grande section", "prescolaire"), [
    "Grande section",
    "prescolaire",
  ]);
});

test("sans cycle", () => {
  assert.deepEqual(tokensNiveau("Terminale S2"), ["Terminale", "S"]);
});

test("vide -> aucun jeton", () => {
  assert.deepEqual(tokensNiveau(""), []);
  assert.deepEqual(tokensNiveau("   "), []);
});

test("cycle déduit du niveau", () => {
  assert.equal(cycleDeNiveau("6e"), "college");
  assert.equal(cycleDeNiveau("CP"), "elementaire");
  assert.equal(cycleDeNiveau("Terminale"), "lycee");
  assert.equal(cycleDeNiveau("Grande section"), "prescolaire");
  assert.equal(cycleDeNiveau("inconnu"), null);
});

test("classe complète niveau + série", () => {
  assert.equal(classeComplete("Terminale", "S1"), "Terminale S1");
  assert.equal(classeComplete("6e", null), "6e");
  assert.equal(classeComplete("6e", ""), "6e");
});

test("encoder / decoder le cookie niveau", () => {
  assert.equal(encoderNiveau("lycee", "Terminale S1"), "lycee|Terminale S1");
  assert.deepEqual(decoderNiveau("lycee|Terminale S1"), {
    cycle: "lycee",
    classe: "Terminale S1",
  });
  assert.equal(decoderNiveau("nimportequoi"), null);
  assert.equal(decoderNiveau(undefined), null);
  assert.equal(decoderNiveau("lycee|"), null);
});
