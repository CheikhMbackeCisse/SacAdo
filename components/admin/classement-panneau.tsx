"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  basculerPersonnalisation,
  chercherProduitScore,
  definirClassementManuel,
  definirCoefficientSaison,
  enregistrerPoids,
  enregistrerSaison,
  getApercu,
  recalculerScoreGlobal,
  retirerClassementManuel,
  supprimerSaison,
  type ConfigClassement,
  type LigneApercu,
  type LigneManuel,
  type LigneScore,
  type RendementExploration,
  type SaisonAdmin,
} from "@/lib/admin/classement-actions";

type Props = {
  config: ConfigClassement;
  top: LigneScore[];
  manuel: LigneManuel[];
  saisons: SaisonAdmin[];
  categories: { id: number; nom: string }[];
  rendement: RendementExploration[];
};

const CARTE = "flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-5";
const CHAMP =
  "min-h-10 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none";

function pct(v: number | undefined): string {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}
function formatHeure(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Africa/Dakar",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClassementPanneau({ config, top, manuel, saisons, categories, rendement }: Props) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-5">
      <SectionPersonnalisation actif={config.persoActive} onChange={() => router.refresh()} />
      <SectionPoids config={config} onDone={() => router.refresh()} />
      <SectionClassement top={top} />
      <SectionManuel manuel={manuel} onDone={() => router.refresh()} />
      <SectionSaisons saisons={saisons} categories={categories} onDone={() => router.refresh()} />
      <SectionRendement rendement={rendement} />
    </div>
  );
}

// --- 6.5 Interrupteur de personnalisation -----------------------------------
function SectionPersonnalisation({ actif, onChange }: { actif: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const basculer = async () => {
    setBusy(true);
    await basculerPersonnalisation(!actif);
    setBusy(false);
    onChange();
  };
  return (
    <div className={CARTE}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-ink">Personnalisation</h2>
          <p className="mt-1 text-xs text-ink/55">
            {actif
              ? "Chaque visiteur voit un accueil adapté à son affinité."
              : "Désactivée : tout le monde voit le même classement (score global seul)."}
          </p>
        </div>
        <button
          type="button"
          onClick={basculer}
          disabled={busy}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            actif ? "border border-ink/15 text-ink" : "bg-brand text-surface"
          }`}
        >
          {actif ? "Désactiver" : "Réactiver"}
        </button>
      </div>
    </div>
  );
}

// --- 6.1 Poids + 6.2 Aperçu ----------------------------------------------------
const POIDS = [
  { cle: "performance", label: "Performance" },
  { cle: "saisonnalite", label: "Saisonnalité" },
  { cle: "marge", label: "Marge" },
  { cle: "fraicheur", label: "Fraîcheur" },
  { cle: "affinite", label: "Affinité personnelle" },
] as const;

function SectionPoids({ config, onDone }: { config: ConfigClassement; onDone: () => void }) {
  const [poids, setPoids] = useState({
    performance: config.performance,
    saisonnalite: config.saisonnalite,
    marge: config.marge,
    fraicheur: config.fraicheur,
    affinite: config.affinite,
  });
  const [apercu, setApercu] = useState<LigneApercu[] | null>(null);
  const [busy, setBusy] = useState<"" | "apercu" | "save" | "recalc">("");
  const [msg, setMsg] = useState<string | null>(null);

  const set = (cle: string, v: number) => setPoids((p) => ({ ...p, [cle]: v }));

  const voirApercu = async () => {
    setBusy("apercu");
    setApercu(await getApercu(poids));
    setBusy("");
  };
  const enregistrer = async () => {
    setBusy("save");
    const r = await enregistrerPoids(poids);
    setBusy("");
    setMsg(r.ok ? "Poids enregistrés. Ils s'appliqueront au prochain recalcul." : "Échec.");
    if (r.ok) onDone();
  };
  const recalculer = async () => {
    setBusy("recalc");
    const r = await recalculerScoreGlobal();
    setBusy("");
    setMsg(r.ok ? `Classement recalculé (${formatHeure(r.calculeLe!)}).` : r.error);
    if (r.ok) onDone();
  };

  return (
    <div className={CARTE}>
      <div>
        <h2 className="font-heading text-base font-semibold text-ink">Poids du score</h2>
        <p className="mt-1 text-xs text-ink/55">
          Modifier un poids ne change rien en production tant que « Recalculer maintenant »
          n&apos;est pas lancé. L&apos;aperçu montre le classement que produiraient ces poids.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {POIDS.map(({ cle, label }) => (
          <label key={cle} className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between text-xs text-ink/60">
              {label}
              <span className="font-mono text-ink">{poids[cle as keyof typeof poids].toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={cle === "affinite" ? 1.5 : 1}
              step={0.05}
              value={poids[cle as keyof typeof poids]}
              onChange={(e) => set(cle, Number(e.target.value))}
              className="accent-brand"
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={voirApercu}
          disabled={busy !== ""}
          className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
        >
          {busy === "apercu" ? "…" : "Aperçu"}
        </button>
        <button
          type="button"
          onClick={enregistrer}
          disabled={busy !== ""}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-surface disabled:opacity-50"
        >
          {busy === "save" ? "…" : "Enregistrer les poids"}
        </button>
        <button
          type="button"
          onClick={recalculer}
          disabled={busy !== ""}
          className="rounded-full border border-brand/40 px-4 py-2 text-sm font-medium text-brand disabled:opacity-50"
        >
          {busy === "recalc" ? "Recalcul…" : "Recalculer maintenant"}
        </button>
      </div>
      {msg && <p className="text-xs text-ink/70">{msg}</p>}

      {apercu && (
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
                <th className="px-3 py-2">Aperçu</th>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2 text-right">Rang actuel</th>
                <th className="px-3 py-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {apercu
                .filter((l) => l.rangApercu <= 20)
                .map((l) => (
                  <tr key={l.produitId} className="border-b border-ink/5 last:border-0">
                    <td className="px-3 py-1.5 text-ink/40">{l.rangApercu}</td>
                    <td className="px-3 py-1.5 text-ink">{l.nom}</td>
                    <td className="px-3 py-1.5 text-right text-ink/60">
                      {l.rangActuel}
                      {l.rangApercu < l.rangActuel ? " ↑" : l.rangApercu > l.rangActuel ? " ↓" : ""}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs text-ink/70">
                      {l.scoreApercu.toFixed(3)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- 6.3 Classement actuel + décomposition ----------------------------------
function SectionClassement({ top }: { top: LigneScore[] }) {
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<LigneScore[] | null>(null);
  const lignes = resultats ?? top;

  const chercher = async (valeur: string) => {
    setQ(valeur);
    if (valeur.trim().length < 2) {
      setResultats(null);
      return;
    }
    setResultats(await chercherProduitScore(valeur));
  };

  return (
    <div className={CARTE}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold text-ink">
          {resultats ? "Résultats" : "Top 20 aujourd'hui"} · décomposition
        </h2>
        <input
          value={q}
          onChange={(e) => chercher(e.target.value)}
          placeholder="Chercher un produit…"
          className={`${CHAMP} w-52`}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-ink/10">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-3 py-2">Produit</th>
              <th className="px-3 py-2 text-right">Score</th>
              <th className="px-3 py-2 text-right">Perf.</th>
              <th className="px-3 py-2 text-right">Saison</th>
              <th className="px-3 py-2 text-right">Marge</th>
              <th className="px-3 py-2 text-right">Fraîch.</th>
              <th className="px-3 py-2 text-right">Vues 30j</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id} className="border-b border-ink/5 last:border-0">
                <td className="px-3 py-1.5 text-ink">{l.nom}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-ink">
                  {l.score_global.toFixed(3)}
                </td>
                <td className="px-3 py-1.5 text-right text-ink/60">{pct(l.details?.performance)}</td>
                <td className="px-3 py-1.5 text-right text-ink/60">{pct(l.details?.saisonnalite)}</td>
                <td className="px-3 py-1.5 text-right text-ink/60">{pct(l.details?.marge)}</td>
                <td className="px-3 py-1.5 text-right text-ink/60">{pct(l.details?.fraicheur)}</td>
                <td className="px-3 py-1.5 text-right text-ink/60">{l.details?.vues_30j ?? "—"}</td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink/45">
                  Aucun produit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- 6.4 Épinglage / exclusion --------------------------------------------------
function SectionManuel({ manuel, onDone }: { manuel: LigneManuel[]; onDone: () => void }) {
  const [id, setId] = useState("");
  const [pos, setPos] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const appliquer = async (produitId: number, champs: { position?: number | null; exclu?: boolean }) => {
    const r = await definirClassementManuel(produitId, champs);
    setMsg(r.ok ? null : ("error" in r ? r.error : "Échec."));
    if (r.ok) onDone();
  };
  const ajouter = async (exclu: boolean) => {
    const pid = Number(id);
    if (!Number.isInteger(pid)) {
      setMsg("Id produit invalide.");
      return;
    }
    await appliquer(pid, exclu ? { exclu: true } : { position: pos ? Number(pos) : null });
    setId("");
    setPos("");
  };

  return (
    <div className={CARTE}>
      <div>
        <h2 className="font-heading text-base font-semibold text-ink">Épinglage &amp; exclusion</h2>
        <p className="mt-1 text-xs text-ink/55">
          Épingler force une position fixe dans le flux. Exclure retire le produit du flux
          d&apos;accueil sans le rendre invisible ailleurs.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink/60">
          Id produit
          <input value={id} onChange={(e) => setId(e.target.value)} className={`${CHAMP} w-28`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink/60">
          Position (épingler)
          <input value={pos} onChange={(e) => setPos(e.target.value)} className={`${CHAMP} w-28`} />
        </label>
        <button
          type="button"
          onClick={() => ajouter(false)}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-surface"
        >
          Épingler
        </button>
        <button
          type="button"
          onClick={() => ajouter(true)}
          className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink"
        >
          Exclure
        </button>
      </div>
      {msg && <p className="text-xs text-red-600">{msg}</p>}

      {manuel.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink/10">
          {manuel.map((l) => (
            <li key={l.produitId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <span className="text-ink/40">#{l.produitId}</span> {l.nom}
                {l.exclu ? (
                  <span className="ml-2 rounded-full bg-ink/10 px-2 py-0.5 text-[11px] text-ink/60">
                    exclu
                  </span>
                ) : (
                  <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand">
                    position {l.position}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await retirerClassementManuel(l.produitId);
                  onDone();
                }}
                className="shrink-0 text-xs font-medium text-ink/50 hover:text-ink"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- 6.6 Saisons -------------------------------------------------------------
function SectionSaisons({
  saisons,
  categories,
  onDone,
}: {
  saisons: SaisonAdmin[];
  categories: { id: number; nom: string }[];
  onDone: () => void;
}) {
  return (
    <div className={CARTE}>
      <h2 className="font-heading text-base font-semibold text-ink">Saisons</h2>
      <p className="text-xs text-ink/55">
        Une saison active dans sa période multiplie le score des catégories listées (1.0 =
        neutre, jamais de pénalité).
      </p>
      <div className="flex flex-col gap-4">
        {saisons.map((s) => (
          <SaisonCarte key={s.id} saison={s} categories={categories} onDone={onDone} />
        ))}
        <SaisonCarte
          saison={{ id: 0, nom: "", debut: "", fin: "", actif: true, coefficients: [] }}
          categories={categories}
          onDone={onDone}
          creation
        />
      </div>
    </div>
  );
}

function SaisonCarte({
  saison,
  categories,
  onDone,
  creation = false,
}: {
  saison: SaisonAdmin;
  categories: { id: number; nom: string }[];
  onDone: () => void;
  creation?: boolean;
}) {
  const [nom, setNom] = useState(saison.nom);
  const [debut, setDebut] = useState(saison.debut);
  const [fin, setFin] = useState(saison.fin);
  const [actif, setActif] = useState(saison.actif);
  const [catId, setCatId] = useState("");
  const [coef, setCoef] = useState("1.3");
  const [msg, setMsg] = useState<string | null>(null);

  const enregistrer = async () => {
    const r = await enregistrerSaison({ id: creation ? undefined : saison.id, nom, debut, fin, actif });
    setMsg(r.ok ? null : ("error" in r ? r.error : "Échec."));
    if (r.ok) {
      if (creation) {
        setNom("");
        setDebut("");
        setFin("");
      }
      onDone();
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ink/10 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Nom de la saison"
          className={`${CHAMP} min-w-40 flex-1`}
        />
        <input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={CHAMP} />
        <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={CHAMP} />
        <label className="flex items-center gap-1.5 text-xs text-ink/60">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="accent-brand" />
          active
        </label>
        <button
          type="button"
          onClick={enregistrer}
          className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-surface"
        >
          {creation ? "Créer" : "Enregistrer"}
        </button>
        {!creation && (
          <button
            type="button"
            onClick={async () => {
              await supprimerSaison(saison.id);
              onDone();
            }}
            className="text-xs font-medium text-ink/40 hover:text-red-600"
          >
            Supprimer
          </button>
        )}
      </div>
      {msg && <p className="text-xs text-red-600">{msg}</p>}

      {!creation && (
        <>
          {saison.coefficients.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {saison.coefficients.map((c) => (
                <button
                  key={c.categorieId}
                  type="button"
                  onClick={async () => {
                    await definirCoefficientSaison(saison.id, c.categorieId, null);
                    onDone();
                  }}
                  className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] text-brand"
                  title="Cliquer pour retirer"
                >
                  {c.categorieNom} ×{c.coefficient} ✕
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <select value={catId} onChange={(e) => setCatId(e.target.value)} className={`${CHAMP} min-w-40`}>
              <option value="">Ajouter une catégorie…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
            <input value={coef} onChange={(e) => setCoef(e.target.value)} className={`${CHAMP} w-20`} />
            <button
              type="button"
              onClick={async () => {
                if (!catId) return;
                await definirCoefficientSaison(saison.id, Number(catId), Number(coef));
                setCatId("");
                onDone();
              }}
              className="rounded-full border border-ink/15 px-3.5 py-1.5 text-xs font-medium text-ink"
            >
              Ajouter
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// --- 6.7 Rendement de l'exploration ----------------------------------------
function SectionRendement({ rendement }: { rendement: RendementExploration[] }) {
  const expl = rendement.find((r) => r.origine === "exploration");
  const score = rendement.find((r) => r.origine === "score");
  const conseil =
    expl && score && expl.impressions > 50 && score.impressions > 50
      ? expl.taux > score.taux
        ? "L'exploration convertit MIEUX que le classement : tu peux augmenter sa part (ou son quota)."
        : "L'exploration convertit moins bien : la réserve de 4 places reste raisonnable."
      : "Pas encore assez d'impressions pour conclure.";

  return (
    <div className={CARTE}>
      <h2 className="font-heading text-base font-semibold text-ink">Rendement de l&apos;exploration</h2>
      <p className="text-xs text-ink/55">
        Taux de conversion (ajouts panier / impressions) des 30 derniers jours, par origine
        d&apos;affichage sur l&apos;accueil.
      </p>
      <div className="overflow-x-auto rounded-xl border border-ink/10">
        <table className="w-full min-w-[360px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-3 py-2">Origine</th>
              <th className="px-3 py-2 text-right">Impressions</th>
              <th className="px-3 py-2 text-right">Ajouts panier</th>
              <th className="px-3 py-2 text-right">Taux</th>
            </tr>
          </thead>
          <tbody>
            {rendement.map((r) => (
              <tr key={r.origine} className="border-b border-ink/5 last:border-0">
                <td className="px-3 py-1.5 text-ink">{r.origine}</td>
                <td className="px-3 py-1.5 text-right text-ink/60">{r.impressions}</td>
                <td className="px-3 py-1.5 text-right text-ink/60">{r.ajoutsPanier}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-ink">{pct(r.taux)}</td>
              </tr>
            ))}
            {rendement.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-ink/45">
                  Aucune donnée encore.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink/70">{conseil}</p>
    </div>
  );
}
