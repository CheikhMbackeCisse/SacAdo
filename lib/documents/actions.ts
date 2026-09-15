"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifierJetonClient } from "@/lib/client-auth";
import { clientIdAutorise } from "@/lib/client-session";
import { commandeHonoree } from "@/lib/commandes/honoree";

// TACHE_documents_telechargeables.md, lot 3 — accès de l'acheteur aux notices
// de montage. Même mécanique que lib/ebooks/actions.ts : le fichier vit dans
// un bucket PRIVÉ, le client ne l'obtient que via une URL signée générée ici
// après vérification de son jeton. Décision de session : pas de filigrane PDF
// (cohérent avec le choix déjà fait pour les ebooks scolaires — simplicité
// plutôt que personnalisation).

const DUREE_LIEN_SECONDES = 900; // 15 minutes (§3 du document source)

type CommandeAcces = {
  id: number;
  client_id: number;
  statut: string;
  mode_paiement: string;
  statut_paiement: string | null;
};

type DocumentLigne = {
  id: number;
  titre: string;
  type: "notice" | "guide";
  taille_ko: number | null;
  actif: boolean;
  acces: "libre" | "apres_achat";
  chemin_fichier: string;
};

export type DocumentDebloque = {
  id: number;
  titre: string;
  type: "notice" | "guide";
  tailleKo: number | null;
  produitNom: string;
};

async function documentsLibres(): Promise<DocumentDebloque[]> {
  const { data } = await supabaseAdmin
    .from("documents")
    .select("id, titre, type, taille_ko")
    .eq("acces", "libre")
    .eq("actif", true);
  return (data ?? []).map((d) => ({
    id: d.id,
    titre: d.titre,
    type: d.type,
    tailleKo: d.taille_ko,
    produitNom: "",
  }));
}

// Tous les documents auxquels ce client a droit : accès libre (toujours), ou
// après achat d'un produit auquel le document est rattaché, dans une commande
// honorée — toutes ses commandes, pas seulement la dernière. Base de « Mes
// documents » : cette liste ne disparaît jamais (§6 du document source).
export async function getDocumentsClient(
  telephone: string,
  jeton: string,
): Promise<DocumentDebloque[]> {
  const libres = await documentsLibres();

  const clientId = await clientIdAutorise(telephone, jeton);
  if (!clientId) return libres;

  const { data: commandes } = await supabaseAdmin
    .from("commandes")
    .select("id, statut, mode_paiement, statut_paiement")
    .eq("client_id", clientId);
  const commandeIdsHonorees = (commandes ?? []).filter(commandeHonoree).map((c) => c.id);
  if (commandeIdsHonorees.length === 0) return libres;

  const { data: items } = await supabaseAdmin
    .from("commande_items")
    .select("produit_id, produit:produits(nom)")
    .in("commande_id", commandeIdsHonorees);
  if (!items || items.length === 0) return libres;

  const nomParProduit = new Map<number, string>();
  const produitIds = new Set<number>();
  for (const item of items) {
    produitIds.add(item.produit_id);
    const produit = Array.isArray(item.produit) ? item.produit[0] : item.produit;
    if (produit) nomParProduit.set(item.produit_id, produit.nom);
  }

  const { data: liens } = await supabaseAdmin
    .from("documents_produits")
    .select("produit_id, document:documents(id, titre, type, taille_ko, actif, acces)")
    .in("produit_id", [...produitIds]);

  const parApresAchat = new Map<number, DocumentDebloque>();
  for (const lien of liens ?? []) {
    const document = (Array.isArray(lien.document) ? lien.document[0] : lien.document) as
      | Omit<DocumentLigne, "chemin_fichier">
      | null;
    if (!document || !document.actif || document.acces !== "apres_achat") continue;
    if (parApresAchat.has(document.id)) continue;
    parApresAchat.set(document.id, {
      id: document.id,
      titre: document.titre,
      type: document.type,
      tailleKo: document.taille_ko,
      produitNom: nomParProduit.get(lien.produit_id) ?? "",
    });
  }

  return [...libres, ...parApresAchat.values()];
}

// Documents débloqués par UNE commande précise (fiche produit / suivi juste
// après achat) — même forme que getEbooksCommande.
export async function getDocumentsCommande(
  commandeId: number,
  jeton: string,
): Promise<DocumentDebloque[]> {
  if (!Number.isFinite(commandeId) || !jeton) return [];

  const { data } = await supabaseAdmin
    .from("commandes")
    .select("id, client_id, statut, mode_paiement, statut_paiement")
    .eq("id", commandeId)
    .maybeSingle();
  const commande = data as CommandeAcces | null;
  if (!commande || !verifierJetonClient(commande.client_id, jeton) || !commandeHonoree(commande)) {
    return [];
  }

  const { data: items } = await supabaseAdmin
    .from("commande_items")
    .select("produit_id, produit:produits(nom)")
    .eq("commande_id", commandeId);
  if (!items || items.length === 0) return [];

  const nomParProduit = new Map<number, string>();
  const produitIds = items.map((item) => {
    const produit = Array.isArray(item.produit) ? item.produit[0] : item.produit;
    if (produit) nomParProduit.set(item.produit_id, produit.nom);
    return item.produit_id;
  });

  const { data: liens } = await supabaseAdmin
    .from("documents_produits")
    .select("produit_id, document:documents(id, titre, type, taille_ko, actif, acces)")
    .in("produit_id", produitIds);

  const sortie: DocumentDebloque[] = [];
  for (const lien of liens ?? []) {
    const document = (Array.isArray(lien.document) ? lien.document[0] : lien.document) as
      | Omit<DocumentLigne, "chemin_fichier">
      | null;
    if (!document || !document.actif || document.acces !== "apres_achat") continue;
    sortie.push({
      id: document.id,
      titre: document.titre,
      type: document.type,
      tailleKo: document.taille_ko,
      produitNom: nomParProduit.get(lien.produit_id) ?? "",
    });
  }
  return sortie;
}

// Vrai si ce client (déjà authentifié par jeton) a acheté, dans une commande
// honorée, au moins un produit rattaché à ce document.
async function clientADroitAuDocument(clientId: number, documentId: number): Promise<boolean> {
  const { data: produits } = await supabaseAdmin
    .from("documents_produits")
    .select("produit_id")
    .eq("document_id", documentId);
  const produitIds = (produits ?? []).map((p) => p.produit_id);
  if (produitIds.length === 0) return false;

  const { data: commandes } = await supabaseAdmin
    .from("commandes")
    .select("id, statut, mode_paiement, statut_paiement")
    .eq("client_id", clientId);
  const commandeIdsHonorees = (commandes ?? []).filter(commandeHonoree).map((c) => c.id);
  if (commandeIdsHonorees.length === 0) return false;

  const { count } = await supabaseAdmin
    .from("commande_items")
    .select("id", { count: "exact", head: true })
    .in("commande_id", commandeIdsHonorees)
    .in("produit_id", produitIds);
  return (count ?? 0) > 0;
}

export type LienDocumentResult =
  | { ok: true; url: string; titre: string }
  | { ok: false; error: string };

async function lireDocumentTelechargeable(documentId: number): Promise<DocumentLigne | null> {
  const { data } = await supabaseAdmin
    .from("documents")
    .select("id, titre, chemin_fichier, actif, acces")
    .eq("id", documentId)
    .maybeSingle();
  const document = data as DocumentLigne | null;
  return document && document.actif ? document : null;
}

async function signerEtJournaliser(
  document: DocumentLigne,
  clientId: number | null,
  commandeId: number | null,
): Promise<LienDocumentResult> {
  const { data: signe, error } = await supabaseAdmin.storage
    .from("documents")
    .createSignedUrl(document.chemin_fichier, DUREE_LIEN_SECONDES);
  if (error || !signe) return { ok: false, error: "Impossible de générer le lien de téléchargement." };

  await supabaseAdmin
    .from("telechargements")
    .insert({ document_id: document.id, client_id: clientId, commande_id: commandeId });

  return { ok: true, url: signe.signedUrl, titre: document.titre };
}

// Point d'entrée « Mes documents » / fiche produit : identité par téléphone +
// jeton (lib/local/identite.ts). Vérifie l'accès (libre, ou jeton + achat
// honoré sur N'IMPORTE laquelle des commandes du client), signe une URL de 15
// minutes, journalise dans `telechargements`. Jamais de contrôle côté
// navigateur (§3 du document source) : tout ici tourne côté serveur avec
// service_role.
export async function getLienDocument(
  documentId: number,
  telephone: string,
  jeton: string,
): Promise<LienDocumentResult> {
  const document = await lireDocumentTelechargeable(documentId);
  if (!document) return { ok: false, error: "Document introuvable." };

  let clientId: number | null = null;
  if (document.acces === "apres_achat") {
    clientId = await clientIdAutorise(telephone, jeton);
    if (!clientId) return { ok: false, error: "Session invalide, réessaie." };
    if (!(await clientADroitAuDocument(clientId, documentId))) {
      return { ok: false, error: "Ce document ne fait pas partie de tes achats." };
    }
  }

  return signerEtJournaliser(document, clientId, null);
}

// Point d'entrée « Mes commandes » / page /suivi/[id] : identité par
// commandeId + jeton, même mécanique que lib/ebooks/actions.ts. N'exige PAS le
// numéro de téléphone (déjà indisponible à cet endroit) — seul le produit
// acheté dans CETTE commande compte.
export async function getLienDocumentCommande(
  commandeId: number,
  jeton: string,
  documentId: number,
): Promise<LienDocumentResult> {
  const document = await lireDocumentTelechargeable(documentId);
  if (!document) return { ok: false, error: "Document introuvable." };

  if (document.acces === "libre") return signerEtJournaliser(document, null, commandeId);

  const { data } = await supabaseAdmin
    .from("commandes")
    .select("id, client_id, statut, mode_paiement, statut_paiement")
    .eq("id", commandeId)
    .maybeSingle();
  const commande = data as CommandeAcces | null;
  if (!commande || !verifierJetonClient(commande.client_id, jeton) || !commandeHonoree(commande)) {
    return { ok: false, error: "Session invalide, réessaie." };
  }

  const { data: produits } = await supabaseAdmin
    .from("documents_produits")
    .select("produit_id")
    .eq("document_id", documentId);
  const produitIds = (produits ?? []).map((p) => p.produit_id);
  const { count } = await supabaseAdmin
    .from("commande_items")
    .select("id", { count: "exact", head: true })
    .eq("commande_id", commandeId)
    .in("produit_id", produitIds.length > 0 ? produitIds : [-1]);
  if (!count) return { ok: false, error: "Ce document ne fait pas partie de cette commande." };

  return signerEtJournaliser(document, commande.client_id, commandeId);
}
