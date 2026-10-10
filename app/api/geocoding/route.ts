import { type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";
import { MIN_CARACTERES_RECHERCHE, type ResultatLieu } from "@/lib/geocoding";

export const dynamic = "force-dynamic";

// Proxy de recherche d'adresse (GROUPE_A_ui_kit_carte.md §2).
//  1. lieux connus (table lieux_connus, saisis dans l'admin) — PRIORITAIRES
//  2. Nominatim / OpenStreetMap — gratuit, sans clé
//
// Passer par le serveur permet de : fixer un User-Agent conforme aux
// conditions Nominatim, borner le débit (1 req/s max chez eux), mettre en
// cache, et fusionner les deux sources.

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "SacAdo/1.0 (+https://sacado.sn; fournitures scolaires Senegal)";
const MAX_RESULTATS = 6;

// Cache mémoire par instance : évite de rappeler Nominatim pour une saisie déjà
// vue pendant un checkout (frappe lettre par lettre).
const cache = new Map<string, { at: number; resultats: ResultatLieu[] }>();
const CACHE_TTL_MS = 10 * 60_000;

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < MIN_CARACTERES_RECHERCHE) {
    return Response.json({ resultats: [] });
  }

  const cle = q.toLowerCase();
  const enCache = cache.get(cle);
  if (enCache && Date.now() - enCache.at < CACHE_TTL_MS) {
    return Response.json({ resultats: enCache.resultats });
  }

  // Garde-fou anti-abus sur notre proxy (Nominatim tolère ~1 req/s).
  const ip = await getClientIp();
  if (!(await verifierLimite(`geocoding:${ip}`, 40, 60))) {
    return Response.json({ resultats: [], erreur: "Trop de recherches, réessaie dans un instant." }, {
      status: 429,
    });
  }

  const lieuxConnus = await chercherLieuxConnus(q);
  // Un lieu connu est un point curé (admin), toujours plus fiable qu'un
  // résultat OSM pour la même recherche — qui peut tomber à plusieurs km du
  // repère réel (vu sur "École Polytechnique de Thiès" : ~4,3 km d'écart) et
  // induire le client en erreur sur l'endroit à choisir (TACHE_bug_checkout_
  // ept.md). On ne va chercher sur OSM que si aucun lieu connu ne répond.
  const osm = lieuxConnus.length > 0 ? [] : await chercherNominatim(q);

  const resultats: ResultatLieu[] = [...lieuxConnus];
  for (const r of osm) {
    if (resultats.length >= MAX_RESULTATS) break;
    const doublon = resultats.some(
      (x) => Math.abs(x.lat - r.lat) < 0.002 && Math.abs(x.lng - r.lng) < 0.002,
    );
    if (!doublon) resultats.push(r);
  }

  cache.set(cle, { at: Date.now(), resultats });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);

  return Response.json({ resultats });
}

async function chercherLieuxConnus(q: string): Promise<ResultatLieu[]> {
  const motif = `%${q.replace(/[%_\\]/g, " ")}%`;
  const { data } = await supabaseAdmin
    .from("lieux_connus")
    .select("nom, lat, lng")
    .ilike("nom", motif)
    .limit(5);
  return (data ?? []).map((l) => ({
    nom: l.nom as string,
    lat: l.lat as number,
    lng: l.lng as number,
    source: "connu" as const,
  }));
}

async function chercherNominatim(q: string): Promise<ResultatLieu[]> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "sn"); // Sénégal uniquement
  url.searchParams.set("accept-language", "fr");

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{ display_name?: string; lat?: string; lon?: string }>;
    return data
      .filter((d) => d.lat && d.lon && d.display_name)
      .map((d) => ({
        nom: raccourcir(d.display_name as string),
        lat: Number(d.lat),
        lng: Number(d.lon),
        source: "osm" as const,
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch {
    // Nominatim indisponible / timeout : on renvoie juste les lieux connus.
    return [];
  }
}

// display_name Nominatim = chaîne très longue ("École ..., Rue ..., Thiès,
// Région de Thiès, 21000, Sénégal"). On garde les 3 premiers segments utiles.
function raccourcir(displayName: string): string {
  const parts = displayName
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => p.toLowerCase() !== "sénégal" && !/^\d{4,6}$/.test(p));
  return parts.slice(0, 3).join(", ") || displayName;
}
