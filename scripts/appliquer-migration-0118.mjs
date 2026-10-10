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

const { error } = await supabase.from("modeles_messages").upsert(
  {
    code: "commande_fournisseur",
    canal: "whatsapp",
    libelle: "Commande fournisseur",
    titre: null,
    contenu:
      "Bonjour {fournisseur}, c'est SacAdo.\nVoici notre commande {reference} :\n{liste_articles}\n\nLes photos de chaque article sont ici : {lien_bon}\nDites-nous quand tout est prêt, on passe récupérer.",
    ordre: 1,
  },
  { onConflict: "code,canal", ignoreDuplicates: true },
);
if (error) {
  console.error(error);
  process.exit(1);
}
console.log("ok");
