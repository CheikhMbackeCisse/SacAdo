"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifierJetonClient } from "@/lib/client-auth";

// MODULE_EBOOKS.md, Partie 1, lot 4 — accès de l'acheteur à l'ebook offert.
// L'ebook est dans un bucket PRIVÉ : le client ne l'obtient que via une URL
// signée générée ici, après vérification de son jeton et de l'état de la
// commande. Le repartage du lien n'est pas bloqué (décision spec : « protection
// légère »), mais le lien signé expire vite.

export type ClasseEbook = { cycle: string; niveau: string };

const DUREE_LIEN_SECONDES = 300;

type CommandeEbook = {
  client_id: number;
  statut: string;
  mode_paiement: string;
  statut_paiement: string | null;
  ebook_classes: ClasseEbook[] | null;
};

async function lireCommande(commandeId: number, jeton: string): Promise<CommandeEbook | null> {
  if (!Number.isFinite(commandeId) || !jeton) return null;
  const { data } = await supabaseAdmin
    .from("commandes")
    .select("client_id, statut, mode_paiement, statut_paiement, ebook_classes")
    .eq("id", commandeId)
    .maybeSingle();
  const commande = data as CommandeEbook | null;
  if (!commande || !verifierJetonClient(commande.client_id, jeton)) return null;
  return commande;
}

// La commande donne droit à l'ebook une fois « payée » : commande Wave passée
// à 'payee', ou commande à la livraison simplement confirmée (hors du statut
// 'paiement_en_attente', propre aux sessions Wave non abouties).
function commandeHonoree(commande: CommandeEbook): boolean {
  if (commande.statut === "paiement_en_attente") return false;
  if (commande.mode_paiement === "wave") return commande.statut_paiement === "payee";
  return true;
}

// Classes de kit de la commande pour lesquelles un ebook est réellement
// disponible ET la commande donne droit au téléchargement. « Mes commandes »
// affiche un bouton par entrée.
export async function getEbooksCommande(
  commandeId: number,
  jeton: string,
): Promise<(ClasseEbook & { titre: string })[]> {
  const commande = await lireCommande(commandeId, jeton);
  if (!commande || !commandeHonoree(commande)) return [];

  const classes = commande.ebook_classes ?? [];
  if (classes.length === 0) return [];

  const sortie: (ClasseEbook & { titre: string })[] = [];
  for (const classe of classes) {
    const { data } = await supabaseAdmin
      .from("ebook_classes")
      .select("ebook:ebooks(titre)")
      .eq("cycle", classe.cycle)
      .eq("niveau", classe.niveau)
      .maybeSingle();
    const jointure = data as { ebook: { titre: string } | { titre: string }[] | null } | null;
    const ebook = jointure
      ? Array.isArray(jointure.ebook)
        ? jointure.ebook[0]
        : jointure.ebook
      : null;
    if (ebook) sortie.push({ ...classe, titre: ebook.titre });
  }
  return sortie;
}

export type LienEbookResult =
  | { ok: true; url: string; titre: string }
  | { ok: false; error: string };

export async function getLienEbook(
  commandeId: number,
  jeton: string,
  cycle: string,
  niveau: string,
): Promise<LienEbookResult> {
  const commande = await lireCommande(commandeId, jeton);
  if (!commande) return { ok: false, error: "Commande introuvable." };
  if (!commandeHonoree(commande)) {
    return { ok: false, error: "Ton ebook sera disponible une fois la commande confirmée." };
  }

  const classes = commande.ebook_classes ?? [];
  if (!classes.some((c) => c.cycle === cycle && c.niveau === niveau)) {
    return { ok: false, error: "Cet ebook ne fait pas partie de ta commande." };
  }

  const { data } = await supabaseAdmin
    .from("ebook_classes")
    .select("ebook:ebooks(titre, fichier_chemin)")
    .eq("cycle", cycle)
    .eq("niveau", niveau)
    .maybeSingle();
  const jointure = data as {
    ebook: { titre: string; fichier_chemin: string } | { titre: string; fichier_chemin: string }[] | null;
  } | null;
  const ebook = jointure
    ? Array.isArray(jointure.ebook)
      ? jointure.ebook[0]
      : jointure.ebook
    : null;
  if (!ebook) return { ok: false, error: "L'ebook de cette classe n'est pas encore disponible." };

  const { data: signe, error } = await supabaseAdmin.storage
    .from("ebooks")
    .createSignedUrl(ebook.fichier_chemin, DUREE_LIEN_SECONDES);
  if (error || !signe) return { ok: false, error: "Impossible de générer le lien de téléchargement." };

  return { ok: true, url: signe.signedUrl, titre: ebook.titre };
}
