import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserTerme } from "./normaliser.ts";

test("normaliserTerme : accents, majuscules, espaces multiples", () => {
  assert.equal(normaliserTerme("Clé USB"), "cle usb");
  assert.equal(normaliserTerme("  Bic   Rouge  "), "bic rouge");
});

test("normaliserTerme : lettres exposant (3ᵉ, Tlᵉ, 1ʳᵉ) ramenées à une forme simple", () => {
  assert.equal(normaliserTerme("3ᵉ"), "3e");
  assert.equal(normaliserTerme("Tlᵉ"), "tle");
  assert.equal(normaliserTerme("1ʳᵉ"), "1re");
});

test("normaliserTerme : formes équivalentes du niveau convergent (C.M.2 / CM 2 / cm2)", () => {
  const attendu = "cm2";
  assert.equal(normaliserTerme("C.M.2"), attendu);
  assert.equal(normaliserTerme("CM 2"), attendu);
  assert.equal(normaliserTerme("cm2"), attendu);
});

test("normaliserTerme : 3ème et 3eme convergent (l'accent est la seule différence)", () => {
  assert.equal(normaliserTerme("3ème"), normaliserTerme("3eme"));
});
