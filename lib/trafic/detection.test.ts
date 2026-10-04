import { test } from "node:test";
import assert from "node:assert/strict";
import { determinerAppareil, determinerNavigateur, determinerSource, hoteDepuisUrl } from "./detection.ts";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FACEBOOK_WEBVIEW =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A]";

test("determinerSource : gclid prime sur tout le reste", () => {
  assert.equal(
    determinerSource({ gclid: "abc", utmSource: "autre_site", siteHote: "sacado.sn", userAgent: CHROME_ANDROID }),
    "google_pub",
  );
});

test("determinerSource : utm_source explicite classé par mots-clés", () => {
  const base = { siteHote: "sacado.sn", userAgent: CHROME_ANDROID };
  assert.equal(determinerSource({ ...base, utmSource: "affiche-lycee-delafosse" }), "affiche");
  assert.equal(determinerSource({ ...base, utmSource: "whatsapp-promo" }), "whatsapp");
  assert.equal(determinerSource({ ...base, utmSource: "newsletter" }), "autre_site");
});

test("determinerSource : webview Facebook sans referrer détecté par l'UA", () => {
  assert.equal(
    determinerSource({ siteHote: "sacado.sn", userAgent: FACEBOOK_WEBVIEW }),
    "facebook",
  );
});

test("determinerSource : referrer externe classé par domaine", () => {
  assert.equal(
    determinerSource({
      siteHote: "sacado.sn",
      userAgent: CHROME_ANDROID,
      referentHote: "www.google.com",
    }),
    "google_recherche",
  );
  assert.equal(
    determinerSource({
      siteHote: "sacado.sn",
      userAgent: CHROME_ANDROID,
      referentHote: "www.example.com",
    }),
    "autre_site",
  );
});

test("determinerSource : même site ou aucun referrer -> direct", () => {
  assert.equal(
    determinerSource({ siteHote: "sacado.sn", userAgent: CHROME_ANDROID, referentHote: "sacado.sn" }),
    "direct",
  );
  assert.equal(determinerSource({ siteHote: "sacado.sn", userAgent: CHROME_ANDROID }), "direct");
});

test("determinerAppareil : android, iphone, ordinateur, autre", () => {
  assert.equal(determinerAppareil(CHROME_ANDROID), "android");
  assert.equal(determinerAppareil(SAFARI_IPHONE), "iphone");
  assert.equal(determinerAppareil(CHROME_DESKTOP), "ordinateur");
});

test("determinerNavigateur : identifie Chrome/Safari/intégré", () => {
  assert.equal(determinerNavigateur(CHROME_DESKTOP), "Chrome");
  assert.equal(determinerNavigateur(SAFARI_IPHONE), "Safari");
  assert.equal(determinerNavigateur(FACEBOOK_WEBVIEW), "Facebook (intégré)");
});

test("hoteDepuisUrl : extrait le nom d'hôte, null si invalide", () => {
  assert.equal(hoteDepuisUrl("https://www.google.com/search?q=sacado"), "www.google.com");
  assert.equal(hoteDepuisUrl(null), null);
  assert.equal(hoteDepuisUrl("pas-une-url"), null);
});
