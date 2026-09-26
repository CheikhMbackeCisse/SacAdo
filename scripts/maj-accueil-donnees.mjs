// SacAdo — maj-accueil/PROMPT-maj-accueil-livraison.md §1, §4, §5
// Catégories (échange d'ordre + photo), prix, mise en avant accueil (classement_manuel).
// Idempotent : peut être relancé sans effet secondaire (upsert / update ciblé).
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
  // ==========================================================================
  // §1 — Catégories : échange d'ordre + nouvelle photo Fournitures scolaires
  // ==========================================================================
  console.log("=== §1 Catégories ===");
  const paires = [
    ["fournitures-ecole", "impression-consommables"],
    ["ecriture", "mobilier"],
  ];
  for (const [slugA, slugB] of paires) {
    const { data: cats, error } = await supabase
      .from("categories")
      .select("id, slug, nom, ordre")
      .in("slug", [slugA, slugB]);
    if (error) throw error;
    const a = cats.find((c) => c.slug === slugA);
    const b = cats.find((c) => c.slug === slugB);
    if (!a || !b) {
      console.log(`  ! Catégorie introuvable pour la paire ${slugA}/${slugB}`);
      continue;
    }
    await supabase.from("categories").update({ ordre: b.ordre }).eq("id", a.id);
    await supabase.from("categories").update({ ordre: a.ordre }).eq("id", b.id);
    console.log(`  ${a.nom} (ordre ${a.ordre}->${b.ordre}) <-> ${b.nom} (ordre ${b.ordre}->${a.ordre})`);
  }

  const { error: imgErr } = await supabase
    .from("categories")
    .update({ image: "/images/cat-fournitures-ecole.webp" })
    .eq("slug", "fournitures-ecole");
  if (imgErr) throw imgErr;
  console.log("  Photo Fournitures d'école mise à jour -> /images/cat-fournitures-ecole.webp");

  // ==========================================================================
  // §4 — Prix
  // ==========================================================================
  console.log("\n=== §4 Prix ===");
  const prixAMettre = [
    { id: 1585, nom: "Kit de Traçage 30 cm 4Pcs – MAPED", nouveauPrix: 1500 },
    { id: 1595, nom: "Kit de Traçage 30 cm 4Pcs Nightfall – MAPED", nouveauPrix: 1500 },
    { id: 1194, nom: "Cartable bleu et mauve motif lapin", nouveauPrix: 7500 },
  ];
  for (const p of prixAMettre) {
    const { data: prod, error } = await supabase
      .from("produits")
      .select("id, nom, prix")
      .eq("id", p.id)
      .maybeSingle();
    if (error) throw error;
    if (!prod) {
      console.log(`  ! Produit id=${p.id} (${p.nom}) introuvable`);
      continue;
    }
    if (prod.prix === p.nouveauPrix) {
      console.log(`  = ${prod.nom} déjà à ${p.nouveauPrix} F`);
      continue;
    }
    await supabase.from("produits").update({ prix: p.nouveauPrix }).eq("id", p.id);
    console.log(`  ✓ ${prod.nom} : ${prod.prix} F -> ${p.nouveauPrix} F`);
  }

  // ==========================================================================
  // §5 — Mise en avant accueil (classement_manuel.position = épinglage)
  // ==========================================================================
  console.log("\n=== §5 Mise en avant accueil ===");
  const miseEnAvant = [
    { position: 2, id: 1609, nom: "Cahier 180P petit format 70G Seyes Spirale Calligraphe" },
    { position: 3, id: 1239, nom: "Blocs Post-it Super Sticky 3M 5 blocs" },
    { position: 4, id: 1585, nom: "Kit de Traçage 30 cm 4Pcs – MAPED" },
    { position: 5, id: 1595, nom: "Kit de Traçage 30 cm 4Pcs Nightfall – MAPED" },
    { position: 6, id: 1274, nom: "Gourde graduee motivationnelle orange" },
    { position: 7, id: 1199, nom: "Cartable rigide bleu marine" },
    { position: 8, id: 1194, nom: "Cartable bleu et mauve motif lapin" },
    { position: 10, id: 39, nom: "MATHEMATIQUES TROISIEME (Korka Diallo)" },
    { position: 11, id: 79, nom: "4 CAHIERS MAGIQUES POUR APPRENDRE A ECRIRE" },
  ];
  for (const item of miseEnAvant) {
    const { data: prod } = await supabase.from("produits").select("id, nom").eq("id", item.id).maybeSingle();
    if (!prod) {
      console.log(`  ! position ${item.position} : produit id=${item.id} introuvable`);
      continue;
    }
    const { error } = await supabase
      .from("classement_manuel")
      .upsert({ produit_id: item.id, position: item.position, exclu: false }, { onConflict: "produit_id" });
    if (error) throw error;
    console.log(`  ✓ position ${item.position} <- [${prod.id}] ${prod.nom}`);
  }

  console.log(
    "\n! Non résolus (voir maj-accueil/rapport.md) : Trousse Hello bleue (1), sac Eastpak (9)," +
      " Une si longue lettre (12, doublon), L'Os de Mor Lam (14, doublon), Ami et Rémi (15, trop générique).",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
