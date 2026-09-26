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

// "liste_fournitures" (page Kits + écran Moi, "Envoyer ma liste") : maj-26-09
// §8 puis maj-accueil §2, photo OU fichier obligatoire.
export type OrigineDemande =
  | "moi"
  | "recherche_vide"
  | "categorie"
  | "fin_de_liste"
  | "liste_fournitures";

const ORIGINES_PHOTO_OBLIGATOIRE: readonly OrigineDemande[] = ["liste_fournitures"];
// Téléphone facultatif pour cette origine (maj-accueil §2) : on cherche le
// produit/la liste sans exiger de contact immédiat.
const ORIGINES_TELEPHONE_FACULTATIF: readonly OrigineDemande[] = ["liste_fournitures"];

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

  const ORIGINES_VALIDES: readonly OrigineDemande[] = [
    "recherche_vide",
    "categorie",
    "fin_de_liste",
    "liste_fournitures",
  ];
  const origine: OrigineDemande = ORIGINES_VALIDES.includes(entree.origine as OrigineDemande)
    ? (entree.origine as OrigineDemande)
    : "moi";

  if (ORIGINES_PHOTO_OBLIGATOIRE.includes(origine) && !entree.photoUrl) {
    return { ok: false, error: "Ajoute une photo pour cette demande." };
  }

  // Identité : jeton + téléphone -> client_id ; sinon numéro saisi obligatoire.
  let clientId: number | null = null;
  const telephone = texte(entree.telephone, TEL_MAX);
  if (telephone && entree.jeton) {
    clientId = await clientIdAutorise(telephone, entree.jeton);
  }
  if (
    !clientId &&
    !ORIGINES_TELEPHONE_FACULTATIF.includes(origine) &&
    telephone.replace(/\D/g, "").length < TEL_CHIFFRES_MIN
  ) {
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

// "liste_fournitures" (maj-accueil §2) : contrairement à televerserPhotoDemande
// ci-dessus, le client peut envoyer une photo OU un document (PDF, Word,
// Excel), jusqu'à 10 Mo. Le fichier est stocké dans la même colonne
// `photo_url` (elle porte mal son nom pour un PDF, mais ce n'est qu'une URL) ;
// l'admin (components/admin/demandes-liste.tsx) affiche un lien au lieu d'un
// aperçu image quand l'extension n'est pas une image.
const TAILLE_MAX_FICHIER_DEMANDE = 10 * 1024 * 1024; // 10 Mo
const EXT_PAR_MIME_FICHIER: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

// Signature réelle du fichier (magic bytes), par grande famille — on ne
// distingue pas doc/docx ou xls/xlsx entre eux (tous deux des conteneurs zip
// OOXML ou OLE), l'objectif est d'écarter un exécutable déguisé, pas de
// valider un format bureautique précis.
function signatureFichierValide(octets: Uint8Array): boolean {
  if (snifferImage(octets)) return true;
  // HEIC/HEIF : boîte ISO-BMFF "ftyp" à l'offset 4.
  if (octets.length >= 8 && octets[4] === 0x66 && octets[5] === 0x74 && octets[6] === 0x79 && octets[7] === 0x70) {
    return true;
  }
  // PDF : "%PDF"
  if (octets.length >= 4 && octets[0] === 0x25 && octets[1] === 0x50 && octets[2] === 0x44 && octets[3] === 0x46) {
    return true;
  }
  // docx/xlsx : conteneur zip (PK\x03\x04)
  if (octets.length >= 4 && octets[0] === 0x50 && octets[1] === 0x4b && octets[2] === 0x03 && octets[3] === 0x04) {
    return true;
  }
  // doc/xls legacy : fichier composé OLE
  if (
    octets.length >= 4 &&
    octets[0] === 0xd0 && octets[1] === 0xcf && octets[2] === 0x11 && octets[3] === 0xe0
  ) {
    return true;
  }
  return false;
}

export async function televerserFichierDemande(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ip = await getClientIp();
  if (!(await verifierLimite(`demande-fichier:${ip}`, 12, 3600))) {
    return { ok: false, error: "Trop d'envois. Réessaie plus tard." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Aucun fichier reçu." };
  if (file.size > TAILLE_MAX_FICHIER_DEMANDE) {
    return { ok: false, error: "Fichier trop lourd (10 Mo maximum)." };
  }

  const ext = EXT_PAR_MIME_FICHIER[file.type];
  if (!ext) return { ok: false, error: "Format accepté : photo, PDF, Word ou Excel." };

  const buffer = await file.arrayBuffer();
  if (!signatureFichierValide(new Uint8Array(buffer.slice(0, 12)))) {
    return { ok: false, error: "Ce fichier n'est pas valide." };
  }

  const chemin = `demandes/${randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from("produits")
    .upload(chemin, buffer, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "Le téléversement a échoué." };

  const { data } = supabaseAdmin.storage.from("produits").getPublicUrl(chemin);
  return { ok: true, url: data.publicUrl };
}
