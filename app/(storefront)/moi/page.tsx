"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, History, Inbox, LifeBuoy, Settings, User } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import { useFavoris } from "@/lib/local/favoris";
import { useConsultes } from "@/lib/local/consultes";
import { getMessagesParTelephone } from "@/lib/moi/actions";
import { getPopulaires, getProduitsByIds } from "@/lib/supabase/queries";
import { ProductGrid } from "@/components/product/product-grid";
import type { Produit } from "@/lib/supabase/types";

const ONGLETS = [
  { href: "/moi/assistance", label: "Assistance", icon: LifeBuoy },
  { href: "/moi/messages", label: "Boîte de réception", icon: Inbox },
  { href: "/favoris", label: "Favoris", icon: Heart },
  { href: "/moi/consultes", label: "Déjà consultés", icon: History },
] as const;

const APERCU_MAX = 4;

export default function MoiPage() {
  const { identite } = useIdentite();
  const { favoris } = useFavoris();
  const { consultes } = useConsultes();
  const [nonLus, setNonLus] = useState(0);
  const [favorisProduits, setFavorisProduits] = useState<Produit[]>([]);
  const [consultesProduits, setConsultesProduits] = useState<Produit[]>([]);
  const [autresProduits, setAutresProduits] = useState<Produit[]>([]);

  useEffect(() => {
    if (!identite) return;
    let active = true;
    getMessagesParTelephone(identite.telephone).then((messages) => {
      if (active) setNonLus(messages.filter((m) => !m.lu).length);
    });
    return () => {
      active = false;
    };
  }, [identite]);

  useEffect(() => {
    let active = true;
    getProduitsByIds(favoris.slice(0, APERCU_MAX)).then((data) => {
      if (active) setFavorisProduits(data);
    });
    return () => {
      active = false;
    };
  }, [favoris]);

  useEffect(() => {
    let active = true;
    const ordre = consultes.slice(0, APERCU_MAX).map((c) => c.id);
    getProduitsByIds(ordre).then((data) => {
      if (!active) return;
      const tries = [...data].sort((a, b) => ordre.indexOf(a.id) - ordre.indexOf(b.id));
      setConsultesProduits(tries);
    });
    return () => {
      active = false;
    };
  }, [consultes]);

  useEffect(() => {
    let active = true;
    // Exclure ce qui est déjà affiché en favoris/consultés pour ne pas
    // montrer trois fois les mêmes articles sur la page.
    getPopulaires(12).then((data) => {
      if (!active) return;
      const dejaAffiches = new Set([...favoris, ...consultes.map((c) => c.id)]);
      setAutresProduits(data.filter((p) => !dejaAffiches.has(p.id)).slice(0, APERCU_MAX));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nonLusAffiches = identite ? nonLus : 0;

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <User size={26} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{identite?.nom || "Client SacAdo"}</p>
          {identite && <p className="text-xs text-ink/50">{identite.telephone}</p>}
        </div>
        <Link
          href="/moi/parametres"
          aria-label="Paramètres"
          className="shrink-0 rounded-full p-2 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <Settings size={20} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-1 rounded-2xl border border-ink/10 bg-white p-3">
        {ONGLETS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="relative flex flex-col items-center gap-1.5 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="line-clamp-2 text-[11px] leading-tight text-ink/70">{label}</span>
            {label === "Boîte de réception" && nonLusAffiches > 0 && (
              <span className="absolute -top-0.5 right-3 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-semibold leading-none text-surface">
                {nonLusAffiches}
              </span>
            )}
          </Link>
        ))}
      </div>

      {favorisProduits.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-ink">Favoris</h2>
            <Link href="/favoris" className="text-xs font-medium text-brand">
              Voir tout
            </Link>
          </div>
          <ProductGrid produits={favorisProduits} />
        </section>
      )}

      {consultesProduits.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold text-ink">Déjà consultés</h2>
            <Link href="/moi/consultes" className="text-xs font-medium text-brand">
              Voir tout
            </Link>
          </div>
          <ProductGrid produits={consultesProduits} />
        </section>
      )}

      {autresProduits.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-base font-semibold text-ink">D&apos;autres articles</h2>
          <ProductGrid produits={autresProduits} />
        </section>
      )}
    </div>
  );
}
