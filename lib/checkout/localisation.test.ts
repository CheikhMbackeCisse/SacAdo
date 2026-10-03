import test from "node:test";
import assert from "node:assert/strict";
import {
  coordonneesValides,
  extraireCoordonneesDepuisTexte,
  extraireCoordonneesDepuisUrl,
  hostnameGoogleMaps,
  lienGoogleMapsDepuisCoordonnees,
} from "./localisation.ts";

test("coordonneesValides : bornes lat/lng", () => {
  assert.equal(coordonneesValides(14.7167, -17.4677), true);
  assert.equal(coordonneesValides(91, 0), false);
  assert.equal(coordonneesValides(0, 181), false);
  assert.equal(coordonneesValides(NaN, 0), false);
});

test("lienGoogleMapsDepuisCoordonnees : lien ouvrable en un toucher", () => {
  assert.equal(
    lienGoogleMapsDepuisCoordonnees(14.7167, -17.4677),
    "https://www.google.com/maps?q=14.7167,-17.4677",
  );
});

test("extraireCoordonneesDepuisTexte : coordonnées brutes, avec ou sans espace", () => {
  assert.deepEqual(extraireCoordonneesDepuisTexte("14.7167, -17.4677"), { lat: 14.7167, lng: -17.4677 });
  assert.deepEqual(extraireCoordonneesDepuisTexte("14.7167,-17.4677"), { lat: 14.7167, lng: -17.4677 });
  assert.equal(extraireCoordonneesDepuisTexte("pas des coordonnées"), null);
  assert.equal(extraireCoordonneesDepuisTexte("200, 0"), null);
});

test("extraireCoordonneesDepuisUrl : format @lat,lng", () => {
  const url = new URL("https://www.google.com/maps/place/Dakar/@14.7167,-17.4677,15z");
  assert.deepEqual(extraireCoordonneesDepuisUrl(url), { lat: 14.7167, lng: -17.4677 });
});

test("extraireCoordonneesDepuisUrl : paramètre q=", () => {
  const url = new URL("https://www.google.com/maps?q=14.7167,-17.4677");
  assert.deepEqual(extraireCoordonneesDepuisUrl(url), { lat: 14.7167, lng: -17.4677 });
});

test("extraireCoordonneesDepuisUrl : lien court sans coordonnées -> null", () => {
  const url = new URL("https://maps.app.goo.gl/abcd1234");
  assert.equal(extraireCoordonneesDepuisUrl(url), null);
});

test("hostnameGoogleMaps : accepte les domaines Google Maps connus", () => {
  assert.equal(hostnameGoogleMaps("maps.app.goo.gl"), true);
  assert.equal(hostnameGoogleMaps("goo.gl"), true);
  assert.equal(hostnameGoogleMaps("www.google.com"), true);
  assert.equal(hostnameGoogleMaps("maps.google.com"), true);
  assert.equal(hostnameGoogleMaps("evil.com"), false);
});
