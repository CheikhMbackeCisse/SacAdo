import test from "node:test";
import assert from "node:assert/strict";
import {
  normaliserTelephoneSN,
  estNumeroMobileSN,
  afficherTelephoneSN,
  lienWhatsAppVers,
  lienAssistanceCommande,
  lienRechercheSansResultat,
  WHATSAPP_NUMERO,
} from "./whatsapp.ts";

test("toutes les formes d'un même numéro donnent le même normalisé", () => {
  const attendu = "221777793522";
  assert.equal(normaliserTelephoneSN("777793522"), attendu);
  assert.equal(normaliserTelephoneSN("77 779 35 22"), attendu);
  assert.equal(normaliserTelephoneSN("+221777793522"), attendu);
  assert.equal(normaliserTelephoneSN("00221 77 779 35 22"), attendu);
  assert.equal(normaliserTelephoneSN("0777793522"), attendu);
  assert.equal(normaliserTelephoneSN("221 77 779 35 22"), attendu);
});

test("numéros inexploitables -> null", () => {
  assert.equal(normaliserTelephoneSN(""), null);
  assert.equal(normaliserTelephoneSN(null), null);
  assert.equal(normaliserTelephoneSN("12345"), null);
  assert.equal(normaliserTelephoneSN("06 12 34 56 78"), null); // 10 chiffres, pas 07
  assert.equal(normaliserTelephoneSN("33123456789"), null); // indicatif étranger
  assert.equal(normaliserTelephoneSN("2217777935221"), null); // 13 chiffres
});

test("préfixe mobile : bien formé mais douteux reste normalisé, signalé à part", () => {
  // 221 + 9 chiffres commençant par 33 (fixe) : structurellement valide…
  assert.equal(normaliserTelephoneSN("221338890000"), "221338890000");
  // …mais pas un mobile connu.
  assert.equal(estNumeroMobileSN("221338890000"), false);
  assert.equal(estNumeroMobileSN("221777793522"), true);
  assert.equal(estNumeroMobileSN("221701234567"), true);
});

test("affichage lisible", () => {
  assert.equal(afficherTelephoneSN("221703202150"), "70 320 21 50");
  assert.equal(afficherTelephoneSN("221777793522"), "77 779 35 22");
  assert.equal(afficherTelephoneSN("garbage"), null);
});

test("lienWhatsAppVers encode le message et masque si invalide", () => {
  assert.equal(
    lienWhatsAppVers("0777793522", "Bonjour à toi"),
    "https://wa.me/221777793522?text=Bonjour%20%C3%A0%20toi",
  );
  assert.equal(lienWhatsAppVers("bruit", "x"), null);
});

test("messages contextuels client : construits via lib/whatsapp.ts, jamais ailleurs", () => {
  assert.equal(
    lienAssistanceCommande(1042),
    `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent("Bonjour, j'ai une question sur ma commande n°1042.")}`,
  );
  assert.equal(
    lienRechercheSansResultat("calculatrice CASIO"),
    `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent('Bonjour, j\'ai cherché "calculatrice CASIO" sur SacAdo et je n\'ai rien trouvé.')}`,
  );
});
