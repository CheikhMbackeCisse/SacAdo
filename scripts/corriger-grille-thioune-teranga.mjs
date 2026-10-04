// PROMPT_ADMIN_KITS_PRODUITS.md, lot 3 : /admin/fournisseurs plantait
// ("Erreur admin") car vendeurs.grille_remise pour "Thioune Teranga" contient
// {categorie: pourcentage} au lieu d'un tableau de paliers {seuil, valeur} —
// partout ailleurs (cet écran, la saisie) suppose cette seconde forme.
// Ce champ a servi une seule fois, au moment de l'import (scripts/importer-
// thioune-teranga.mjs), à calculer le prix d'achat de chaque produit — la
// remise est donc déjà appliquée dans prix_achat ; la valeur stockée après
// coup dans grille_remise n'a plus d'usage et n'est lue nulle part d'autre.
// Usage : node scripts/corriger-grille-thioune-teranga.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: avant, error: errLecture } = await supabase
    .from("vendeurs")
    .select("id, nom_boutique, grille_remise")
    .eq("nom_boutique", "Thioune Teranga")
    .maybeSingle();
  if (errLecture || !avant) {
    console.error("Fournisseur introuvable:", errLecture?.message);
    process.exit(1);
  }
  console.log("Avant:", JSON.stringify(avant.grille_remise));

  const { data, error } = await supabase
    .from("vendeurs")
    .update({ grille_remise: null })
    .eq("id", avant.id)
    .select("id, nom_boutique, grille_remise");
  if (error) {
    console.error("Erreur mise à jour:", error.message);
    process.exit(1);
  }
  console.log("Après:", JSON.stringify(data));
}

main();
