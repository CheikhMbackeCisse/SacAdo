import test from "node:test";
import assert from "node:assert/strict";
import {
  parseEvenementWave,
  signerCorpsWave,
  verifierSignatureHmac,
  TOLERANCE_SECONDES,
} from "./webhook-core.ts";

const SECRET = "whsec_test_123";
const CORPS = JSON.stringify({ id: "EV_1", type: "checkout.session.completed" });

test("signature valide : acceptée", () => {
  const now = Date.now();
  const header = signerCorpsWave(CORPS, SECRET, now);
  assert.equal(verifierSignatureHmac(CORPS, header, SECRET, now), true);
});

test("corps falsifié après signature : rejeté", () => {
  const now = Date.now();
  const header = signerCorpsWave(CORPS, SECRET, now);
  assert.equal(verifierSignatureHmac(CORPS + " ", header, SECRET, now), false);
});

test("mauvais secret : rejeté", () => {
  const now = Date.now();
  const header = signerCorpsWave(CORPS, SECRET, now);
  assert.equal(verifierSignatureHmac(CORPS, header, "whsec_autre", now), false);
});

test("en-tête absent : rejeté", () => {
  assert.equal(verifierSignatureHmac(CORPS, null, SECRET), false);
});

test("horodatage trop ancien : rejeté (anti-rejeu)", () => {
  const emis = Date.now() - (TOLERANCE_SECONDES + 60) * 1000;
  const header = signerCorpsWave(CORPS, SECRET, emis);
  assert.equal(verifierSignatureHmac(CORPS, header, SECRET, Date.now()), false);
});

test("plusieurs v1 (rotation de secret) : accepté si l'un correspond", () => {
  const now = Date.now();
  const bon = signerCorpsWave(CORPS, SECRET, now); // "t=..,v1=.."
  const header = `${bon},v1=deadbeef`;
  assert.equal(verifierSignatureHmac(CORPS, header, SECRET, now), true);
});

test("parse : évènement de paiement réussi", () => {
  const e = parseEvenementWave(
    JSON.stringify({
      id: "EV_2",
      type: "checkout.session.completed",
      data: { id: "cos_1", amount: "12500", client_reference: "ref-abc", payment_status: "succeeded" },
    }),
  );
  assert.deepEqual(e, {
    id: "EV_2",
    resultat: "paye",
    reference: "ref-abc",
    sessionId: "cos_1",
    montant: 12500,
  });
});

test("parse : échec de paiement", () => {
  const e = parseEvenementWave(
    JSON.stringify({ id: "EV_3", type: "checkout.session.payment_failed", data: { id: "cos_2" } }),
  );
  assert.equal(e?.resultat, "echoue");
});

test("parse : évènement non pertinent -> 'autre'", () => {
  const e = parseEvenementWave(JSON.stringify({ id: "EV_4", type: "merchant.balance.updated" }));
  assert.equal(e?.resultat, "autre");
});

test("parse : corps illisible -> null", () => {
  assert.equal(parseEvenementWave("pas du json"), null);
  assert.equal(parseEvenementWave(JSON.stringify({ type: "x" })), null); // pas d'id
});
