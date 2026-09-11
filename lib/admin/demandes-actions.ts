"use server";

import { requireAdmin } from "./guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { origineSite } from "@/lib/site-url";
import { normaliserTelephoneSN } from "@/lib/whatsapp";
import { rendreModele } from "@/lib/messages/modeles";
import { notifierEvenementClient } from "@/lib/messages/notifier-evenement";
import type { ActionResult } from "./produits-actions";

// « Ce que les clients cherchent » — volet demandes explicites (le volet
// recherches sans résultat vit dans recherches-actions.ts). TACHE_corrections_2 §3.6.

export type StatutDemande = "nouvelle" | "en_recherche" | "trouve" | "indisponible";
const STATUTS: StatutDemande[] = ["nouvelle", "en_recherche", "trouve", "indisponible"];

export type Demande = {
  id: string;
  telephone: string;
  description: string;
  precision_produit: string | null;
  photo_url: string | null;
  origine: string | null;
  terme_recherche: string | null;
  statut: StatutDemande;
  produit_id: number | null;
  note_interne: string | null;
  cree_le: string;
};

export async function getDemandes(statut?: StatutDemande | "toutes"): Promise<Demande[]> {
  await requireAdmin();
  let requete = supabaseAdmin
    .from("demandes_produits")
    .select(
      "id, telephone, description, precision_produit, photo_url, origine, terme_recherche, statut, produit_id, note_interne, cree_le",
    )
    // Nouvelles en premier, puis de la plus récente à la plus ancienne.
    .order("cree_le", { ascending: false })
    .limit(300);
  if (statut && statut !== "toutes") requete = requete.eq("statut", statut);
  const { data } = await requete;
  return (data ?? []) as Demande[];
}

async function maj(id: string, champs: Record<string, unknown>): Promise<ActionResult> {
  const { error } = await supabaseAdmin
    .from("demandes_produits")
    .update({ ...champs, maj_le: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "Mise à jour impossible." };
  return { ok: true };
}

export async function changerStatutDemande(
  id: string,
  statut: StatutDemande,
): Promise<ActionResult> {
  await requireAdmin();
  if (!STATUTS.includes(statut)) return { ok: false, error: "Statut invalide." };
  // Repasser hors de « trouvé » détache le produit.
  return maj(id, statut === "trouve" ? { statut } : { statut, produit_id: null });
}

export async function noterDemande(id: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  return maj(id, { note_interne: note.trim().slice(0, 1000) || null });
}

export type ProduitOption = { id: number; nom: string };

export async function chercherProduitsPourRattachement(terme: string): Promise<ProduitOption[]> {
  await requireAdmin();
  const t = terme.trim().slice(0, 80);
  if (t.length < 2) return [];
  const { data } = await supabaseAdmin
    .from("produits")
    .select("id, nom")
    .ilike("nom", `%${t}%`)
    .order("nom", { ascending: true })
    .limit(20);
  return (data ?? []) as ProduitOption[];
}

// Passe la demande à « trouvé », la rattache à un produit du catalogue,
// prévient le client par push + boîte de réception s'il a un compte connu, et
// renvoie un message WhatsApp prérempli avec le lien de la fiche (TOUJOURS
// utilisable : la demande n'a qu'un numéro, pas forcément de compte).
export async function rattacherProduitDemande(
  id: string,
  produitId: number,
): Promise<ActionResult & { message?: string; lien?: string }> {
  await requireAdmin();
  const { data: produit } = await supabaseAdmin
    .from("produits")
    .select("id, nom")
    .eq("id", produitId)
    .maybeSingle();
  if (!produit) return { ok: false, error: "Produit introuvable." };

  const { data: demande } = await supabaseAdmin
    .from("demandes_produits")
    .select("telephone")
    .eq("id", id)
    .maybeSingle();

  const r = await maj(id, { statut: "trouve", produit_id: produitId });
  if (!r.ok) return r;

  const lien = `${await origineSite()}/produit/${produit.id}`;

  // Le numéro de la demande correspond peut-être à un client déjà connu
  // (commande passée un jour) : on le retrouve pour le prévenir en push +
  // boîte de réception, en plus du WhatsApp manuel.
  const normalise = normaliserTelephoneSN(demande?.telephone ?? "");
  let prenom = "Bonjour";
  if (normalise) {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, nom")
      .eq("telephone_normalise", normalise)
      .maybeSingle();
    if (client) {
      prenom = client.nom.trim().split(/\s+/)[0] || prenom;
      await notifierEvenementClient({
        clientId: client.id,
        code: "produit_trouve",
        variables: { prenom, lien_produit: lien, lien },
        lien,
      });
    }
  }

  const { data: modeleWhatsapp } = await supabaseAdmin
    .from("modeles_messages")
    .select("contenu")
    .eq("code", "produit_trouve")
    .eq("canal", "whatsapp")
    .eq("actif", true)
    .maybeSingle();

  const message = modeleWhatsapp?.contenu
    ? rendreModele(modeleWhatsapp.contenu, { prenom, lien_produit: lien, lien })
    : `Bonjour, c'est SacAdo. On a trouvé ce que tu cherchais : ${produit.nom}. Tu peux le commander ici : ${lien}`;

  return { ok: true, message, lien };
}
