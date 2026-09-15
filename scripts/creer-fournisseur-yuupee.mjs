// SacAdo — création du fournisseur Yuupee (TACHE_yuupee_integration_complete.md
// §1). Sans remise : grille_remise reste null, seule grille_majoration est
// posée — la structure permet de basculer vers une remise plus tard sans
// migration (colonne déjà existante depuis 0070).
// Usage : node scripts/creer-fournisseur-yuupee.mjs
// Prérequis : migration 0072 déjà exécutée en base. Lit .env.local. Idempotent
// (upsert par nom_boutique).
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

const VENDEUR_NOM = "Yuupee";

// TACHE_yuupee_integration_complete.md §1 / TACHE_kits_impression_classement.md
// Chantier D. `seuil` = borne haute EXCLUSIVE du prix Yuupee (prix < seuil ->
// cette valeur ; dernier palier `seuil: null` = illimité). Renégociation
// prévue dans 3 mois sur la base du volume : modifiable depuis /admin/fournisseurs,
// pas en dur ailleurs dans le code.
export const GRILLE_MAJORATION_YUUPEE = [
  { seuil: 5000, valeur: 500 },
  { seuil: 20000, valeur: 1000 },
  { seuil: 50000, valeur: 2500 },
  { seuil: 150000, valeur: 5000 },
  { seuil: 400000, valeur: 10000 },
  { seuil: null, valeur: 20000 },
];

async function main() {
  const { data: existant, error: errLecture } = await supabase
    .from("vendeurs")
    .select("id, grille_majoration")
    .ilike("nom_boutique", VENDEUR_NOM)
    .maybeSingle();
  if (errLecture) throw new Error(`Lecture échouée : ${errLecture.message}`);

  if (existant) {
    const { error } = await supabase
      .from("vendeurs")
      .update({ grille_majoration: GRILLE_MAJORATION_YUUPEE, actif: true })
      .eq("id", existant.id);
    if (error) throw new Error(`Mise à jour échouée : ${error.message}`);
    console.log(`= fournisseur déjà présent, grille_majoration mise à jour : ${VENDEUR_NOM} (#${existant.id})`);
    return;
  }

  const { data: cree, error } = await supabase
    .from("vendeurs")
    .insert({
      nom_boutique: VENDEUR_NOM,
      user_id: null,
      contact_telephone: null,
      grille_remise: null,
      grille_majoration: GRILLE_MAJORATION_YUUPEE,
      actif: true,
    })
    .select("id")
    .single();
  if (error || !cree) throw new Error(`Création échouée : ${error?.message}`);
  console.log(`✓ fournisseur créé : ${VENDEUR_NOM} (#${cree.id})`);
  console.log(`  grille_majoration : ${JSON.stringify(GRILLE_MAJORATION_YUUPEE)}`);
  console.log(`  grille_remise : null (à renseigner depuis /admin/fournisseurs si une remise est négociée)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
