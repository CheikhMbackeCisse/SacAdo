import test from "node:test";
import assert from "node:assert/strict";
import { rendreModele, codeModeleStatut } from "./modeles.ts";

test("remplace les variables connues", () => {
  assert.equal(
    rendreModele("Salut {prenom}, commande n°{numero_commande} de {montant} FCFA.", {
      prenom: "Awa",
      numero_commande: 1042,
      montant: "18 500",
    }),
    "Salut Awa, commande n°1042 de 18 500 FCFA.",
  );
});

test("variable absente ou nulle -> chaîne vide, jamais {x} en clair", () => {
  assert.equal(rendreModele("Vers {localite}.", {}), "Vers .");
  assert.equal(rendreModele("Vers {localite}.", { localite: null }), "Vers .");
});

test("laisse le texte sans variable intact", () => {
  assert.equal(rendreModele("Ta commande est livrée.", {}), "Ta commande est livrée.");
});

test("codeModeleStatut : mapping aligné avec le trigger 0058", () => {
  assert.equal(codeModeleStatut("recue"), "commande_confirmee");
  assert.equal(codeModeleStatut("preparation"), "commande_preparation");
  assert.equal(codeModeleStatut("livraison"), "commande_route");
  assert.equal(codeModeleStatut("livree"), "commande_livree");
  assert.equal(codeModeleStatut("probleme"), "commande_probleme");
  assert.equal(codeModeleStatut("paiement_en_attente"), null);
});
