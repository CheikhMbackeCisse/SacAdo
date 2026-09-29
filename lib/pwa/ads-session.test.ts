import { test } from "node:test";
import assert from "node:assert/strict";
import { contientParametrePub } from "./ads-session.ts";

test("contientParametrePub : reconnaît gclid/gbraid/wbraid/utm_source", () => {
  assert.equal(contientParametrePub("?gclid=abc123"), true);
  assert.equal(contientParametrePub("?gbraid=abc123"), true);
  assert.equal(contientParametrePub("?wbraid=abc123"), true);
  assert.equal(contientParametrePub("?utm_source=google"), true);
  assert.equal(contientParametrePub("?utm_source=google&utm_medium=cpc"), true);
});

test("contientParametrePub : faux sur une visite organique", () => {
  assert.equal(contientParametrePub(""), false);
  assert.equal(contientParametrePub("?ref=produit"), false);
});
