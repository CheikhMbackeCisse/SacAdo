import test from "node:test";
import assert from "node:assert/strict";
import { trouverLieuSpecialParPoint, trouverLieuSpecialParTexte } from "./lieu-special.ts";

const EPT = {
  id: 2,
  motsCles: ["EPT", "E.P.T", "polytechnique", "polytech", "école polytechnique", "polytechnique de Thiès"],
  lat: 14.78896,
  lng: -16.9246,
  rayonM: 800,
};

test("texte 'EPT' seul reconnaît le lieu spécial", () => {
  assert.equal(trouverLieuSpecialParTexte("EPT", [EPT])?.id, 2);
});

test("texte 'ecole polytechnique de thies' (sans accents) reconnaît le lieu spécial", () => {
  assert.equal(trouverLieuSpecialParTexte("ecole polytechnique de thies", [EPT])?.id, 2);
});

test("texte sans rapport ne reconnaît rien", () => {
  assert.equal(trouverLieuSpecialParTexte("Sicap Mbao", [EPT]), null);
});

test("épingle exactement sur l'EPT reconnaît le lieu spécial", () => {
  assert.equal(trouverLieuSpecialParPoint(14.78896, -16.9246, [EPT])?.id, 2);
});

test("épingle à ~500m de l'EPT (dans le rayon de 800m) reconnaît le lieu spécial", () => {
  assert.equal(trouverLieuSpecialParPoint(14.793, -16.9246, [EPT])?.id, 2);
});

test("épingle loin de l'EPT (hors rayon) ne reconnaît rien", () => {
  assert.equal(trouverLieuSpecialParPoint(14.7, -16.9, [EPT]), null);
});
