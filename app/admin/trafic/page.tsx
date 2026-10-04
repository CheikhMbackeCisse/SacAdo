import Link from "next/link";
import { Activity, MessageCircle } from "lucide-react";
import {
  getInfosTechniques,
  getLiensSuivi,
  getParcoursAchat,
  getPaniersNonValides,
  getResumeVisites,
  getSources,
  type Periode,
} from "@/lib/admin/trafic-actions";
import { formatPrice } from "@/lib/format";
import { normaliserTelephoneSN, afficherTelephoneSN } from "@/lib/whatsapp";
import { MiniBarChart } from "@/components/admin/trafic/mini-bar-chart";
import { CreerLienForm, BoutonQrLien } from "@/components/admin/trafic/creer-lien-form";

const PERIODES: { value: Periode; label: string }[] = [
  { value: "aujourdhui", label: "Aujourd'hui" },
  { value: "7j", label: "7 jours" },
  { value: "30j", label: "30 jours" },
];

const LIBELLE_SOURCE: Record<string, string> = {
  google_recherche: "Google (recherche)",
  google_pub: "Google (publicité)",
  affiche: "Affiche / QR",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  autre_site: "Autre site",
  direct: "Accès direct",
};

const LIBELLE_APPAREIL: Record<string, string> = {
  android: "Android",
  iphone: "iPhone",
  ordinateur: "Ordinateur",
  autre: "Autre",
};

function Carte({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-ink/10 bg-white p-4 ${className}`}>{children}</div>;
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink/70">{titre}</h2>
      {children}
    </section>
  );
}

export default async function AdminTraficPage(props: PageProps<"/admin/trafic">) {
  const { periode: periodeParam } = await props.searchParams;
  const periode: Periode =
    periodeParam === "7j" || periodeParam === "30j" ? periodeParam : "aujourdhui";

  const [resume, sources, liens, parcours, paniers, infos] = await Promise.all([
    getResumeVisites(periode),
    getSources(periode),
    getLiensSuivi(periode),
    getParcoursAchat(periode),
    getPaniersNonValides(),
    getInfosTechniques(periode),
  ]);

  const maxFunnel = Math.max(1, ...parcours.map((e) => e.sessions));

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Trafic</h1>
        <p className="mt-1 text-xs text-ink/50">Données des 90 derniers jours. Robots exclus.</p>
      </div>

      <div className="flex gap-2">
        {PERIODES.map((p) => (
          <Link
            key={p.value}
            href={`/admin/trafic?periode=${p.value}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              p.value === periode ? "border-brand bg-brand text-surface" : "border-ink/15 text-ink/70"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <Section titre="Visites">
        <div className="grid grid-cols-3 gap-2">
          <Carte className="text-center">
            <p className="text-xl font-bold text-ink">{resume.visiteursUniques}</p>
            <p className="text-[11px] text-ink/50">Visiteurs uniques</p>
          </Carte>
          <Carte className="text-center">
            <p className="text-xl font-bold text-ink">{resume.pagesVues}</p>
            <p className="text-[11px] text-ink/50">Pages vues</p>
          </Carte>
          <Carte className="text-center">
            <p className="text-xl font-bold text-brand">{resume.enCeMoment}</p>
            <p className="text-[11px] text-ink/50">En ce moment</p>
          </Carte>
        </div>
        <Carte>
          <MiniBarChart points={resume.parJour.map((j) => ({ jour: j.jour, valeur: j.visiteursUniques }))} />
        </Carte>
      </Section>

      <Section titre="D'où ils viennent">
        <Carte className="flex flex-col divide-y divide-ink/5 p-0">
          {sources.length === 0 ? (
            <p className="p-4 text-sm text-ink/40">Pas encore de données.</p>
          ) : (
            sources.map((s) => (
              <div key={s.sourceType} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-ink/80">{LIBELLE_SOURCE[s.sourceType] ?? s.sourceType}</span>
                <span className="text-ink/50">
                  {s.visites} visite{s.visites > 1 ? "s" : ""} · {s.commandes} commande{s.commandes > 1 ? "s" : ""}
                </span>
              </div>
            ))
          )}
        </Carte>
      </Section>

      <Section titre="Liens et QR codes">
        <CreerLienForm />
        <Carte className="flex flex-col divide-y divide-ink/5 p-0">
          {liens.length === 0 ? (
            <p className="p-4 text-sm text-ink/40">Aucun lien suivi créé.</p>
          ) : (
            liens.map((l) => (
              <div key={l.id} className="flex flex-col gap-1.5 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">{l.libelle ?? l.code}</span>
                  <span className="text-xs text-ink/50">
                    {l.visites} visite{l.visites > 1 ? "s" : ""} · {l.commandes} commande{l.commandes > 1 ? "s" : ""}
                  </span>
                </div>
                <p className="break-all text-xs text-ink/40">{l.url}</p>
                <BoutonQrLien utmSource={l.utmSource} utmCampaign={l.utmCampaign} code={l.code} />
              </div>
            ))
          )}
        </Carte>
      </Section>

      <Section titre="Parcours d'achat">
        <Carte className="flex flex-col gap-2.5">
          {parcours.map((e) => (
            <div key={e.etape} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink/80">{e.etape}</span>
                <span className="text-ink/50">
                  {e.sessions} · {e.taux}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-ink/5">
                <div
                  className="h-2 rounded-full bg-brand"
                  style={{ width: `${Math.max(2, (e.sessions / maxFunnel) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </Carte>
      </Section>

      <Section titre="Paniers non validés (72 h)">
        {paniers.length === 0 ? (
          <Carte>
            <p className="text-sm text-ink/40">Aucun panier abandonné pour le moment.</p>
          </Carte>
        ) : (
          <div className="flex flex-col gap-2">
            {paniers.map((p) => {
              const numero = normaliserTelephoneSN(p.telephone);
              const lienWhatsApp = numero
                ? `https://wa.me/${numero}?text=${encodeURIComponent(
                    `Bonjour, il vous reste ${p.produits[0]?.nom ?? "un article"} dans votre panier SacAdo. Voulez-vous qu'on vous aide à finaliser votre commande ?`,
                  )}`
                : null;
              return (
                <Carte key={p.sessionId}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{formatPrice(p.montant)}</p>
                      <p className="text-xs text-ink/50">
                        {LIBELLE_SOURCE[p.source] ?? p.source} · dernière activité{" "}
                        {new Date(p.derniereActivite).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    {lienWhatsApp && (
                      <a
                        href={lienWhatsApp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70"
                      >
                        <MessageCircle size={12} aria-hidden="true" />
                        {afficherTelephoneSN(numero)}
                      </a>
                    )}
                  </div>
                  <ul className="mt-2 text-xs text-ink/60">
                    {p.produits.map((produit) => (
                      <li key={produit.produitId}>
                        {produit.quantite} × {produit.nom}
                      </li>
                    ))}
                  </ul>
                </Carte>
              );
            })}
          </div>
        )}
      </Section>

      <Section titre="Infos techniques">
        <div className="grid grid-cols-2 gap-2">
          <Carte>
            <p className="mb-1.5 text-xs font-medium text-ink/50">Appareils</p>
            {infos.appareils.map((a) => (
              <div key={a.appareil} className="flex justify-between text-xs text-ink/70">
                <span>{LIBELLE_APPAREIL[a.appareil] ?? a.appareil}</span>
                <span>{a.sessions}</span>
              </div>
            ))}
          </Carte>
          <Carte>
            <p className="mb-1.5 text-xs font-medium text-ink/50">Navigateurs</p>
            {infos.navigateurs.map((n) => (
              <div key={n.navigateur} className="flex justify-between text-xs text-ink/70">
                <span>{n.navigateur}</span>
                <span>{n.sessions}</span>
              </div>
            ))}
          </Carte>
        </div>

        <Carte>
          <p className="text-sm text-ink/70">
            <span className="font-semibold text-ink">{infos.appInstallee}</span> session
            {infos.appInstallee > 1 ? "s" : ""} depuis l&apos;app installée (sur{" "}
            {infos.appareils.reduce((s, a) => s + a.sessions, 0)} au total).
          </p>
        </Carte>

        <Carte>
          <p className="mb-1.5 text-xs font-medium text-ink/50">Pages les plus vues</p>
          {infos.pagesPlusVues.map((p) => (
            <div key={p.page} className="flex justify-between text-xs text-ink/70">
              <span className="truncate">{p.page}</span>
              <span className="shrink-0">{p.vues}</span>
            </div>
          ))}
        </Carte>

        <Carte>
          <p className="mb-1.5 text-xs font-medium text-ink/50">Produits les plus vus</p>
          {infos.produitsPlusVus.map((p) => (
            <div key={p.produitId} className="flex justify-between text-xs text-ink/70">
              <span className="truncate">{p.nom}</span>
              <span className="shrink-0">{p.vues}</span>
            </div>
          ))}
        </Carte>

        {infos.pages404.length > 0 && (
          <Carte>
            <p className="mb-1.5 text-xs font-medium text-ink/50">Pages en erreur (404)</p>
            {infos.pages404.map((p) => (
              <div key={p.page} className="flex justify-between text-xs text-ink/70">
                <span className="truncate">{p.page}</span>
                <span className="shrink-0">{p.vues}</span>
              </div>
            ))}
          </Carte>
        )}

        <Link
          href="/admin/recherches"
          className="flex items-center gap-1.5 text-xs font-medium text-brand"
        >
          <Activity size={13} aria-hidden="true" />
          Voir les recherches sans résultat →
        </Link>
      </Section>
    </div>
  );
}
