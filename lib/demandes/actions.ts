"use server";

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clientIdAutorise } from "@/lib/client-session";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";
import { TYPES_IMAGE, TAILLE_MAX_PHOTO, snifferImage } from "@/lib/images/sniff";

// « Demander un produit » (TACHE_corrections_2.md §3). Remplace la porte d'entrée
// vendeur côté client : le visiteur signale ce qu'il cherche et que SacAdo ne
// vend pas encore. Rapproché des recherches sans résultat côté admin.

const SID_COOKIE = "sacado_sid";
const DESC_MAX = 600;
const PRECISION_MAX = 300;
const TEL_MAX = 30;
const TEL_CHIFFRES_MIN = 6;

export type OrigineDemande = "moi" | "recherche_vide" | "categorie";

export type DemandeResult = { ok: true } | { ok: false; error: string };

type Entree = {
  description: string;
  precisionProduit?: string | null;
  photoUrl?: string | null;
  origine: OrigineDemande;
  termeRecherche?: string | null;
  // Identité facultative : si le jeton est absent, `telephone` saisi est requis.
  telephone?: string | null;
  jeton?: string | null;
};

function texte(v: unknown, max: number): string {
  return String(v ?? "").trim().slice(0, max);
}

export async function creerDemandeProduit(entree: Entree): Promise<DemandeResult> {
  const ip = await getClientIp();
  if (!(await verifierLimite(`demande:${ip}`, 8, 3600))) {
    return { ok: false, error: "Trop de demandes envoyées. Réessaie plus tard." };
  }

  const description = texte(entree.description, DESC_MAX);
  if (description.length < 3) return { ok: false, error: "Dis-nous ce que tu cherches." };

  const origine: OrigineDemande =
    entree.origine === "recherche_vide" || entree.origine === "categorie" ? entree.origine : "moi";

  // Identité : jeton + téléphone -> client_id ; sinon numéro saisi obligatoire.
  let clientId: number | null = null;
  const telephone = texte(entree.telephone, TEL_MAX);
  if (telephone && entree.jeton) {
    clientId = await clientIdAutorise(telephone, entree.jeton);
  }
  if (!clientId && telephone.replace(/\D/g, "").length < TEL_CHIFFRES_MIN) {
    return { ok: false, error: "Indique un numéro WhatsApp valide." };
  }

  let sessionId: string | null = null;
  try {
    sessionId = (await cookies()).get(SID_COOKIE)?.value ?? null;
  } catch {
    sessionId = null;
  }

  const { error } = await supabaseAdmin.from("demandes_produits").insert({
    client_id: clientId,
    session_id: sessionId,
    telephone,
    description,
    precision_produit: texte(entree.precisionProduit, PRECISION_MAX) || null,
    photo_url: entree.photoUrl ? String(entree.photoUrl).slice(0, 500) : null,
    origine,
    terme_recherche:
      origine === "recherche_vide" ? texte(entree.termeRecherche, 120) || null : null,
  });
  if (error) return { ok: false, error: "Envoi impossible pour le moment." };
  return { ok: true };
}

export async function televerserPhotoDemande(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ip = await getClientIp();
  if (!(await verifierLimite(`demande-photo:${ip}`, 12, 3600))) {
    return { ok: false, error: "Trop d'envois. Réessaie plus tard." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier reçu." };
  if (file.size > TAILLE_MAX_PHOTO) return { ok: false, error: "Image trop lourde (3 Mo maximum)." };

  const ext = TYPES_IMAGE[file.type];
  if (!ext) return { ok: false, error: "Format accepté : JPG, PNG ou WebP." };

  const buffer = await file.arrayBuffer();
  const typeReel = snifferImage(new Uint8Array(buffer.slice(0, 12)));
  if (!typeReel || typeReel !== ext) {
    return { ok: false, error: "Ce fichier n'est pas une image valide." };
  }

  const chemin = `demandes/${randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("produits")
    .upload(chemin, buffer, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "Le téléversement a échoué." };

  const { data } = supabaseAdmin.storage.from("produits").getPublicUrl(chemin);
  return { ok: true, url: data.publicUrl };
}
