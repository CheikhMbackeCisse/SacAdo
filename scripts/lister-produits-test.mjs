// Chantier A (TACHE_nettoyage_carrousel_preferences.md §A.1) — lecture seule.
// Liste les produits qui ressemblent à des données de test, avec leurs
// références (commandes, kits, favoris, consultés) pour savoir lesquels
// peuvent être supprimés sans casser l'historique. NE SUPPRIME RIEN.
// Usage : node scripts/lister-produits-test.mjs
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

const NOMS_SUSPECTS = ["%test%", "%demo%", "%exemple%", "%lorem%"];
const NOMS_COURTS = /^(a|aa|aaa|azerty|qwerty|xxx)$/i;

async function main() {
  const { data: produits, error } = await supabase
    .from("produits")
    .select("id, nom, prix, vendeur_id, statut_publication, created_at, vendeurs(nom_boutique)")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Erreur lecture produits:", error.message);
    process.exit(1);
  }

  const suspects = produits.filter((p) => {
    const nom = (p.nom ?? "").toLowerCase();
    return (
      NOMS_SUSPECTS.some((motif) => nom.includes(motif.replace(/%/g, ""))) ||
      NOMS_COURTS.test(p.nom ?? "") ||
      p.prix === 0
    );
  });

  if (suspects.length === 0) {
    console.log("Aucun produit suspect trouvé (nom test/demo/exemple/lorem, nom court, ou prix à 0).");
    return;
  }

  console.log(`${suspects.length} produit(s) suspect(s) :\n`);

  for (const p of suspects) {
    const [{ count: nbCommandes }, { count: nbKits }, { count: nbFavCompte }, { count: nbFavSession }, { count: nbConsCompte }, { count: nbConsSession }] =
      await Promise.all([
        supabase.from("commande_items").select("id", { count: "exact", head: true }).eq("produit_id", p.id),
        supabase.from("kit_items").select("id", { count: "exact", head: true }).eq("produit_id", p.id),
        supabase.from("favoris_compte").select("client_id", { count: "exact", head: true }).eq("produit_id", p.id),
        supabase.from("favoris_session").select("session_id", { count: "exact", head: true }).eq("produit_id", p.id),
        supabase.from("consultes_compte").select("client_id", { count: "exact", head: true }).eq("produit_id", p.id),
        supabase.from("consultes_session").select("session_id", { count: "exact", head: true }).eq("produit_id", p.id),
      ]);

    const references = nbCommandes + nbKits;
    const marque = references > 0 ? "⚠ RÉFÉRENCÉ — ne pas supprimer, archiver" : "supprimable";

    console.log(
      `#${p.id}  "${p.nom}"  ${p.prix} FCFA  vendeur=${p.vendeurs?.nom_boutique ?? "?"}  statut=${p.statut_publication}  créé=${p.created_at?.slice(0, 10)}`,
    );
    console.log(
      `      commandes=${nbCommandes}  kits=${nbKits}  favoris(compte/session)=${nbFavCompte}/${nbFavSession}  consultés(compte/session)=${nbConsCompte}/${nbConsSession}  -> ${marque}`,
    );
  }

  console.log(`\n${suspects.length} produit(s) au total à relire avant toute action.`);
}

main();
