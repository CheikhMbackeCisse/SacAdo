"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "./produits-actions";
import type { EnvoiWhatsApp, StatutCommande } from "@/lib/supabase/types";
import { rendreModele, codeModeleStatut, type VariablesModele } from "@/lib/messages/modeles";
import { journaliserNotification } from "@/lib/messages/journal";
import {
  normaliserTelephoneSN,
  estNumeroMobileSN,
  afficherTelephoneSN,
  WHATSAPP_AFFICHE,
} from "@/lib/whatsapp";
import { jetonClient } from "@/lib/client-auth";
import { origineSite } from "@/lib/site-url";

// Bloc WhatsApp de la fiche commande (TACHE_whatsapp_admin.md §6). Aucun envoi
// automatique : on prépare des liens wa.me avec le texte, l'admin relit, envoie,
// puis confirme — ce qui journalise dans `envois_whatsapp` (§7).

export type BoutonWhatsApp = {
  code: string;
  libelle: string;
  contenu: string; // texte final, variables résolues
  lien: string; // https://wa.me/...
  correspondStatut: boolean;
};

export type BlocWhatsApp = {
  numeroSacado: string; // numéro d'entreprise à garder connecté (§1)
  telephoneAffiche: string | null;
  numeroValide: boolean;
  numeroDouteux: boolean;
  lienMessageLibre: string | null;
  boutons: BoutonWhatsApp[];
  historique: EnvoiWhatsApp[];
};

type CommandeRow = {
  id: number;
  client_id: number;
  total: number;
  statut: string;
  localite_nom: string | null;
  telephone_normalise: string | null;
  client: { nom: string; telephone: string } | { nom: string; telephone: string }[] | null;
};

async function lireCommande(commandeId: number): Promise<CommandeRow | null> {
  const { data } = await supabaseAdmin
    .from("commandes")
    .select("id, client_id, total, statut, localite_nom, telephone_normalise, client:clients(nom, telephone)")
    .eq("id", commandeId)
    .maybeSingle();
  return (data as CommandeRow | null) ?? null;
}

function numeroDe(commande: CommandeRow, clientTelephone: string): string | null {
  return commande.telephone_normalise ?? normaliserTelephoneSN(clientTelephone);
}

export async function getBlocWhatsApp(commandeId: number): Promise<BlocWhatsApp | null> {
  await requireAdmin();

  const commande = await lireCommande(commandeId);
  if (!commande) return null;

  const client = Array.isArray(commande.client) ? commande.client[0] : commande.client;
  const nom = client?.nom ?? "";
  const telephone = client?.telephone ?? "";

  const normalise = numeroDe(commande, telephone);
  const numeroValide = Boolean(normalise);
  const numeroDouteux = numeroValide && !estNumeroMobileSN(normalise);

  const { data: items } = await supabaseAdmin
    .from("commande_items")
    .select("quantite, kit_groupe_id, kit_nom, kit_classe, produit:produits(nom)")
    .eq("commande_id", commandeId);

  // Un kit scolaire/une liste personnalisée ne doit pas exploser en 20+ noms
  // de produits dans le message WhatsApp (CORRECTIONS_V15 Lot 2) : une seule
  // mention par groupe. kit_classe absent = ligne de liste (lib/commande/
  // groupe-rpc.ts), jamais de kit scolaire (toujours une classe).
  type ItemRow = {
    quantite: number;
    kit_groupe_id: string | null;
    kit_nom: string | null;
    kit_classe: string | null;
    produit: { nom: string } | { nom: string }[] | null;
  };
  const kits = new Map<string, { nom: string; estKit: boolean; nbArticles: number }>();
  const articlesHorsKit: string[] = [];
  for (const row of (items ?? []) as unknown as ItemRow[]) {
    if (row.kit_groupe_id) {
      const kit =
        kits.get(row.kit_groupe_id) ?? { nom: row.kit_nom ?? "Article groupé", estKit: row.kit_classe !== null, nbArticles: 0 };
      kit.nbArticles += row.quantite;
      kits.set(row.kit_groupe_id, kit);
      continue;
    }
    const nomProduit = Array.isArray(row.produit) ? row.produit[0]?.nom : row.produit?.nom;
    if (nomProduit) articlesHorsKit.push(nomProduit);
  }
  const articles =
    [
      ...[...kits.values()].map((k) => `${k.estKit ? "Kit" : "Liste"} ${k.nom} (${k.nbArticles} articles)`),
      ...articlesHorsKit,
    ].join(", ") || "un article";

  const lienCommande = `${await origineSite()}/suivi/${commande.id}?t=${jetonClient(commande.client_id)}`;

  const variables: VariablesModele = {
    prenom: nom.trim().split(/\s+/)[0] || "",
    numero_commande: commande.id,
    montant: Math.round(commande.total).toLocaleString("fr-FR"),
    localite: commande.localite_nom ?? "ta localité",
    articles,
    lien_commande: lienCommande,
    lien: lienCommande,
    lien_produit: "",
  };

  const { data: modeles } = await supabaseAdmin
    .from("modeles_messages")
    .select("code, libelle, contenu")
    .eq("canal", "whatsapp")
    .eq("actif", true)
    .order("ordre", { ascending: true });

  const codeStatut = codeModeleStatut(commande.statut as StatutCommande);

  const boutons: BoutonWhatsApp[] = numeroValide
    ? (modeles ?? []).map((m) => {
        const contenu = rendreModele(m.contenu as string, variables);
        return {
          code: m.code as string,
          libelle: m.libelle as string,
          contenu,
          lien: `https://wa.me/${normalise}?text=${encodeURIComponent(contenu)}`,
          correspondStatut: m.code === codeStatut,
        };
      })
    : [];

  const { data: histo } = await supabaseAdmin
    .from("envois_whatsapp")
    .select("*")
    .eq("commande_id", commandeId)
    .order("cree_le", { ascending: false });

  return {
    numeroSacado: WHATSAPP_AFFICHE,
    telephoneAffiche: afficherTelephoneSN(normalise),
    numeroValide,
    numeroDouteux,
    lienMessageLibre: numeroValide ? `https://wa.me/${normalise}` : null,
    boutons,
    historique: (histo ?? []) as EnvoiWhatsApp[],
  };
}

const CONTENU_MAX = 3000;

export async function confirmerEnvoiWhatsApp(input: {
  commandeId: number;
  code: string | null;
  contenu: string;
}): Promise<ActionResult> {
  const user = await requireAdmin();

  const commande = await lireCommande(input.commandeId);
  if (!commande) return { ok: false, error: "Commande introuvable." };

  const client = Array.isArray(commande.client) ? commande.client[0] : commande.client;
  const normalise = numeroDe(commande, client?.telephone ?? "");
  if (!normalise) return { ok: false, error: "Numéro de téléphone inexploitable." };

  const contenu = input.contenu.trim();
  if (!contenu) return { ok: false, error: "Contenu vide." };
  if (contenu.length > CONTENU_MAX) return { ok: false, error: "Contenu trop long." };

  const { error } = await supabaseAdmin.from("envois_whatsapp").insert({
    commande_id: input.commandeId,
    client_id: commande.client_id,
    telephone: normalise,
    code_modele: input.code,
    contenu_envoye: contenu.slice(0, CONTENU_MAX),
    envoye_par: user.id,
    confirme: true,
  });
  if (error) return { ok: false, error: "Impossible d'enregistrer l'envoi." };

  await journaliserNotification({
    clientId: commande.client_id,
    commandeId: input.commandeId,
    canal: "whatsapp",
    type: input.code ?? "libre",
    statut: "envoye",
  });
  return { ok: true };
}
