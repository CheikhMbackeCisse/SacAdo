import test from "node:test";
import assert from "node:assert/strict";
import { calculerDateLivraison } from "./date-livraison.ts";

// Les instants sont donnés à midi UTC = midi Dakar (aucun décalage).
test("mercredi 30 septembre 2026 -> livraison le 4 octobre", () => {
  const d = calculerDateLivraison(new Date("2026-09-30T12:00:00Z"), null, []);
  assert.equal(d, "2026-10-04");
});

test("dimanche 4 octobre 2026 -> livraison le 10 octobre", () => {
  const d = calculerDateLivraison(new Date("2026-10-04T12:00:00Z"), null, []);
  assert.equal(d, "2026-10-10");
});

test("samedi sans heure limite -> livraison le dimanche (lendemain)", () => {
  // 2026-10-03 est un samedi.
  const d = calculerDateLivraison(new Date("2026-10-03T20:00:00Z"), null, []);
  assert.equal(d, "2026-10-04");
});

test("samedi après l'heure limite -> passe au samedi suivant", () => {
  const d = calculerDateLivraison(new Date("2026-10-03T15:30:00Z"), "14:00", []);
  assert.equal(d, "2026-10-10");
});

test("samedi avant l'heure limite -> livraison le dimanche", () => {
  const d = calculerDateLivraison(new Date("2026-10-03T10:00:00Z"), "14:00", []);
  assert.equal(d, "2026-10-04");
});

test("date calculée fermée -> avance au prochain samedi/dimanche ouvert", () => {
  // Mercredi -> dimanche 2026-10-04, fermé -> prochain samedi 2026-10-10.
  const d = calculerDateLivraison(new Date("2026-09-30T12:00:00Z"), null, ["2026-10-04"]);
  assert.equal(d, "2026-10-10");
});
