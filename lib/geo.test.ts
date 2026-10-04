import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceKm, pointDansPolygone } from "./geo.ts";

test("distanceKm : point identique -> 0", () => {
  assert.equal(distanceKm(14.6928, -17.4467, 14.6928, -17.4467), 0);
});

test("distanceKm : Dakar Plateau -> Pikine, environ 10-12 km", () => {
  const d = distanceKm(14.6928, -17.4467, 14.7515, -17.3964);
  assert.ok(d > 5 && d < 15, `distance inattendue: ${d}`);
});

test("pointDansPolygone : point au centre d'un carré -> dedans", () => {
  const carre: [number, number][] = [
    [-17.5, 14.6],
    [-17.4, 14.6],
    [-17.4, 14.7],
    [-17.5, 14.7],
  ];
  assert.equal(pointDansPolygone(14.65, -17.45, carre), true);
});

test("pointDansPolygone : point hors du carré -> dehors", () => {
  const carre: [number, number][] = [
    [-17.5, 14.6],
    [-17.4, 14.6],
    [-17.4, 14.7],
    [-17.5, 14.7],
  ];
  assert.equal(pointDansPolygone(14.9, -17.45, carre), false);
});
