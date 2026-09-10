import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { idsBeneficiairesValides } from "@/lib/beneficiaires";

// Écriture des signaux bruts dans `evenements` (TACHE_algorithme_classement.md
// « chantier C »). Best-effort : une mesure qui échoue ne doit JAMAIS casser la
// page ou l'action de l'utilisateur. Écriture via service_role (table RLS sans
// policy). Jamais lue par une requête d'affichage.

const SID_COOKIE = "sacado_sid";
const RECHERCHE_MAX = 120;

export type EvenementType =
  | "vue_produit"
  | "vue_categorie"
  | "recherche"
  | "ajout_panier"
  | "commande";

type EntreeEvenement = {
  type: EvenementType;
  produitId?: number | null;
  categorieId?: number | null;
  sousCategorieId?: number | null;
  recherche?: string | null;
  clientId?: number | null;
  // Fourni explicitement quand on n'est pas dans un contexte de requête (rare) ;
  // sinon lu dans le cookie `sacado_sid`.
  sessionId?: string | null;
};

async function sessionCourante(explicite?: string | null): Promise<string | null> {
  if (explicite) return explicite;
  try {
    const jar = await cookies();
    return jar.get(SID_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

export async function journaliserEvenement(entree: EntreeEvenement): Promise<void> {
  try {
    const sessionId = await sessionCourante(entree.sessionId);
    if (!sessionId) return; // pas de session anonyme -> on ne mesure pas

    const produitId = entree.produitId ?? null;
    let categorieId = entree.categorieId ?? null;
    let sousCategorieId = entree.sousCategorieId ?? null;

    // Contexte catégorie résolu EN BASE à partir du produit : le client n'envoie
    // qu'un `produitId`, il ne peut pas forger le rattachement catégorie.
    if (produitId && categorieId == null && sousCategorieId == null) {
      const { data } = await supabaseAdmin
        .from("produits")
        .select("categorie_id, sous_categorie_id")
        .eq("id", produitId)
        .maybeSingle();
      if (data) {
        categorieId = data.categorie_id ?? null;
        sousCategorieId = data.sous_categorie_id ?? null;
      }
    }

    const recherche = entree.recherche
      ? entree.recherche.trim().slice(0, RECHERCHE_MAX) || null
      : null;

    await supabaseAdmin.from("evenements").insert({
      session_id: sessionId,
      client_id: entree.clientId ?? null,
      type: entree.type,
      produit_id: produitId,
      categorie_id: categorieId,
      sous_categorie_id: sousCategorieId,
      recherche,
    });
  } catch {
    // best-effort
  }
}

// Signal fort et explicite : une ligne `commande` par produit acheté, rattachée
// au client. Conservée même sans cookie de session (repli dérivé du client_id).
// `beneficiaireId` (produits d'un kit) est écrit seulement après vérification
// qu'il appartient bien au compte — TACHE_identite §2.3 « une mauvaise
// attribution est pire qu'une absence d'attribution ».
export type LigneCommande = { produitId: number; beneficiaireId?: number | null };

export async function journaliserCommande(
  lignesCommande: LigneCommande[],
  opts: { clientId: number; sessionId?: string | null },
): Promise<void> {
  try {
    const parProduit = new Map<number, number | null>();
    for (const l of lignesCommande) {
      if (!Number.isFinite(l.produitId) || l.produitId <= 0) continue;
      // dernier gagne si un produit apparaît deux fois
      parProduit.set(l.produitId, l.beneficiaireId ?? null);
    }
    const ids = [...parProduit.keys()];
    if (ids.length === 0) return;

    const sessionId = (await sessionCourante(opts.sessionId)) ?? `client:${opts.clientId}`;

    const benefsDemandes = [
      ...new Set([...parProduit.values()].filter((v): v is number => v != null)),
    ];
    const benefsValides = benefsDemandes.length
      ? await idsBeneficiairesValides(opts.clientId, benefsDemandes)
      : new Set<number>();

    const { data: produits } = await supabaseAdmin
      .from("produits")
      .select("id, categorie_id, sous_categorie_id")
      .in("id", ids);
    const parId = new Map((produits ?? []).map((p) => [p.id, p]));

    const lignes = ids.map((pid) => {
      const p = parId.get(pid);
      const benef = parProduit.get(pid) ?? null;
      return {
        session_id: sessionId,
        client_id: opts.clientId,
        beneficiaire_id: benef != null && benefsValides.has(benef) ? benef : null,
        type: "commande" as const,
        produit_id: pid,
        categorie_id: p?.categorie_id ?? null,
        sous_categorie_id: p?.sous_categorie_id ?? null,
      };
    });

    const { error } = await supabaseAdmin.from("evenements").insert(lignes);
    // 42703 : colonne beneficiaire_id absente (migration 0050 pas encore passée).
    if (error?.code === "42703") {
      const sansBenef = lignes.map((l) => {
        const copie: Record<string, unknown> = { ...l };
        delete copie.beneficiaire_id;
        return copie;
      });
      await supabaseAdmin.from("evenements").insert(sansBenef);
    }
  } catch {
    // best-effort
  }
}
