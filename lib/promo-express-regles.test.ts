import test from "node:test";
import assert from "node:assert/strict";
import {
  estJourPromoActif,
  prochaineDatePromo,
  validerConfigPromoExpress,
  type ConfigPromoExpress,
} from "./promo-express-regles.ts";

const base: ConfigPromoExpress = {
  actif: true,
  joursRecurrents: [5], // vendredi
  datesPonctuelles: [],
  heureLimite: "18:00",
};

test("jour récurrent avant l'heure limite : actif", () => {
  // 2026-10-09 est un vendredi, 10h UTC = 10h Dakar.
  assert.equal(estJourPromoActif(base, new Date("2026-10-09T10:00:00Z")), true);
});

test("jour récurrent après l'heure limite : inactif", () => {
  assert.equal(estJourPromoActif(base, new Date("2026-10-09T19:00:00Z")), false);
});

test("jour non concerné : inactif", () => {
  // 2026-10-10 est un samedi.
  assert.equal(estJourPromoActif(base, new Date("2026-10-10T10:00:00Z")), false);
});

test("date ponctuelle hors jour récurrent : active ce jour-là seulement", () => {
  const config: ConfigPromoExpress = { ...base, joursRecurrents: [], datesPonctuelles: ["2026-10-10"] };
  assert.equal(estJourPromoActif(config, new Date("2026-10-10T10:00:00Z")), true);
  assert.equal(estJourPromoActif(config, new Date("2026-10-11T10:00:00Z")), false);
});

test("config inactive : jamais, même un jour/heure valides", () => {
  assert.equal(estJourPromoActif({ ...base, actif: false }, new Date("2026-10-09T10:00:00Z")), false);
});

test("prochaineDatePromo : aujourd'hui si jour récurrent et avant l'heure limite", () => {
  // 2026-10-09 est un vendredi.
  assert.equal(prochaineDatePromo(base, new Date("2026-10-09T10:00:00Z")), "2026-10-09");
});

test("prochaineDatePromo : vendredi prochain si l'heure limite est passée aujourd'hui", () => {
  assert.equal(prochaineDatePromo(base, new Date("2026-10-09T19:00:00Z")), "2026-10-16");
});

test("prochaineDatePromo : vendredi prochain un autre jour de la semaine", () => {
  // 2026-10-10 est un samedi.
  assert.equal(prochaineDatePromo(base, new Date("2026-10-10T10:00:00Z")), "2026-10-16");
});

test("prochaineDatePromo : null si désactivée ou sans aucun jour configuré", () => {
  assert.equal(prochaineDatePromo({ ...base, actif: false }, new Date("2026-10-09T10:00:00Z")), null);
  assert.equal(
    prochaineDatePromo({ ...base, joursRecurrents: [], datesPonctuelles: [] }, new Date("2026-10-09T10:00:00Z")),
    null,
  );
});

test("prochaineDatePromo : une date ponctuelle plus proche prime sur le jour récurrent", () => {
  const config: ConfigPromoExpress = { ...base, datesPonctuelles: ["2026-10-12"] };
  assert.equal(prochaineDatePromo(config, new Date("2026-10-10T10:00:00Z")), "2026-10-12");
});

test("validerConfigPromoExpress rejette une config malformée", () => {
  assert.equal(validerConfigPromoExpress({ actif: true, joursRecurrents: [8], datesPonctuelles: [], heureLimite: "18:00" }), null);
  assert.equal(validerConfigPromoExpress({ actif: true, joursRecurrents: [5], datesPonctuelles: [], heureLimite: "25:00" }), null);
  assert.equal(validerConfigPromoExpress(null), null);
  assert.deepEqual(validerConfigPromoExpress(base), base);
});
