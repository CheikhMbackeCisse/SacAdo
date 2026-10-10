// TACHE_commandes_fournisseurs_promo_express.md Lot 2a : numéros WhatsApp des
// fournisseurs (vendeurs.contact_telephone, colonne déjà existante,
// migration 0036). Correspondance confirmée avec le fondateur le 2026-10-10 :
// LPD = le bon fournisseur, MedWorld = 76 17 51 80 5 (donné en direct).
// Usage : node scripts/renseigner-whatsapp-fournisseurs.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const NUMEROS = {
  "LPD": "77 644 01 56",
  "Papex": "76 887 97 87",
  "Cissé & Frères": "78 444 84 59",
  "Yuupee": "78 112 48 12",
  "Thioune Teranga": "77 871 00 69",
  "Kaladi Business Company": "77 851 98 98",
  "Karbi": "78 460 97 97",
  "MedWorld": "76 175 18 05",
};

for (const [nom, numero] of Object.entries(NUMEROS)) {
  const { data, error } = await supabase
    .from("vendeurs")
    .update({ contact_telephone: numero })
    .eq("nom_boutique", nom)
    .is("user_id", null)
    .select("id, nom_boutique, contact_telephone");
  if (error) {
    console.error(nom, error);
    continue;
  }
  if (!data || data.length === 0) {
    console.warn(`Introuvable : ${nom}`);
    continue;
  }
  console.log(data[0].nom_boutique, "->", data[0].contact_telephone);
}
