"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normaliserTerme } from "@/lib/recherche/normaliser";
import { ajouterTermeSynonyme } from "./synonymes-actions";
import type { ActionResult } from "./produits-actions";

// Journal des recherches qui n'ont rien renvoyé (migration 0041, colonnes de
// suivi en 0042). C'est le fichier qui dit ce que les clients cherchent et que
// SacAdo ne vend pas encore — ou vend sous un autre nom.
export type Traitement = "synonyme" | "a_sourcer" | "ignore";

export type RechercheVide = {
  terme: string;
  occurrences: number;
  derniere: string;
  traitement: Traitement | null;
};

const JOURS_HISTORIQUE = 30;
// Garde-fou mémoire : au-delà, l'agrégat reste représentatif (les termes
// fréquents sont de toute façon en tête).
const LIGNES_MAX = 5000;

type LigneJournal = { terme: string; cree_le: string; traitement: Traitement | null };

export async function getRecherchesVides(): Promise<RechercheVide[]> {
  await requireAdmin();

  const depuis = new Date(Date.now() - JOURS_HISTORIQUE * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("recherches_sans_resultat")
    .select("terme, cree_le, traitement")
    .gte("cree_le", depuis)
    .order("cree_le", { ascending: false })
    .limit(LIGNES_MAX);

  // Repli tant que la migration 0042 (colonne `traitement`) n'est pas passée.
  const lignes: LigneJournal[] = error
    ? await (async () => {
        const sansSuivi = await supabaseAdmin
          .from("recherches_sans_resultat")
          .select("terme, cree_le")
          .gte("cree_le", depuis)
          .order("cree_le", { ascending: false })
          .limit(LIGNES_MAX);
        return (sansSuivi.data ?? []).map((l) => ({ ...l, traitement: null }) as LigneJournal);
      })()
    : ((data ?? []) as LigneJournal[]);

  // Les lignes arrivent de la plus récente à la plus ancienne : la première vue
  // pour un terme porte donc sa date la plus récente.
  const parTerme = new Map<string, RechercheVide>();
  for (const ligne of lignes) {
    const terme = normaliserTerme(ligne.terme);
    if (!terme) continue;
    const agrege = parTerme.get(terme);
    if (!agrege) {
      parTerme.set(terme, {
        terme,
        occurrences: 1,
        derniere: ligne.cree_le,
        traitement: ligne.traitement,
      });
      continue;
    }
    agrege.occurrences += 1;
    // Le traitement le plus récent fait foi (les lignes sont déjà triées).
    if (agrege.traitement === null) agrege.traitement = ligne.traitement;
  }

  return [...parTerme.values()].sort(
    (a, b) => b.occurrences - a.occurrences || b.derniere.localeCompare(a.derniere),
  );
}

async function marquer(terme: string, traitement: Traitement): Promise<ActionResult> {
  const normalise = normaliserTerme(terme);
  if (!normalise) return { ok: false, error: "Terme invalide." };

  const { error } = await supabaseAdmin
    .from("recherches_sans_resultat")
    .update({ traitement, traite_le: new Date().toISOString() })
    .eq("terme", normalise);
  if (error) {
    return { ok: false, error: "Suivi indisponible : la migration 0042 n'est pas passée." };
  }
  return { ok: true };
}

export async function marquerRecherche(terme: string, traitement: Traitement): Promise<ActionResult> {
  await requireAdmin();
  if (traitement !== "a_sourcer" && traitement !== "ignore") {
    return { ok: false, error: "Traitement invalide." };
  }
  return marquer(terme, traitement);
}

// Rattacher un terme cherché en vain à un groupe existant : « blanco » rejoint
// le groupe du correcteur, et la recherche renvoie des produits dès la requête
// suivante — sans redéploiement.
export async function rattacherAuGroupe(terme: string, groupe: number): Promise<ActionResult> {
  await requireAdmin();

  const ajout = await ajouterTermeSynonyme(groupe, terme);
  if (!ajout.ok) return ajout;

  // Le synonyme est en place : si le marquage échoue (migration 0042 pas
  // passée), l'action a quand même produit son effet — la ligne restera
  // simplement dans la file d'attente.
  await marquer(terme, "synonyme");
  return { ok: true };
}

export async function reouvrirRecherche(terme: string): Promise<ActionResult> {
  await requireAdmin();
  const normalise = normaliserTerme(terme);
  if (!normalise) return { ok: false, error: "Terme invalide." };

  const { error } = await supabaseAdmin
    .from("recherches_sans_resultat")
    .update({ traitement: null, traite_le: null })
    .eq("terme", normalise);
  if (error) return { ok: false, error: "Impossible de rouvrir ce terme." };
  return { ok: true };
}
