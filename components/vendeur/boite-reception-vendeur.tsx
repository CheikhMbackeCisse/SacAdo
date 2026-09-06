"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Inbox } from "lucide-react";
import { marquerMessageVendeurLu } from "@/lib/vendeur/messages-actions";
import type { MessageVendeur } from "@/lib/supabase/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BoiteReceptionVendeur({ messages }: { messages: MessageVendeur[] }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [lus, setLus] = useState<Set<number>>(new Set());

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#001314]/15 bg-white/60 p-10 text-center">
        <Inbox size={22} className="text-[#001314]/25" aria-hidden="true" />
        <p className="text-sm text-[#001314]/55">Aucun message pour l&apos;instant.</p>
        <p className="text-xs text-[#001314]/40">
          Les décisions de SacAdo sur vos produits apparaîtront ici.
        </p>
      </div>
    );
  }

  const ouvrir = async (message: MessageVendeur) => {
    setOuvert((current) => (current === message.id ? null : message.id));
    if (!message.lu && !lus.has(message.id)) {
      setLus((current) => new Set(current).add(message.id));
      await marquerMessageVendeurLu(message.id);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-col divide-y divide-[#001314]/10 rounded-2xl border border-[#001314]/10 bg-white">
      {messages.map((message) => {
        const lu = message.lu || lus.has(message.id);
        return (
          <div key={message.id} className="flex flex-col">
            <button
              type="button"
              onClick={() => ouvrir(message)}
              className="flex flex-col gap-1 px-4 py-3 text-left hover:bg-[#001314]/[0.02]"
            >
              <div className="flex items-center gap-2">
                {!lu && (
                  <span className="size-2 shrink-0 rounded-full bg-[#0B3D91]" aria-hidden="true" />
                )}
                <span
                  className={`flex-1 text-sm ${lu ? "text-[#001314]/70" : "font-semibold text-[#001314]"}`}
                >
                  {message.titre}
                </span>
                <span className="shrink-0 text-[11px] text-[#001314]/40">
                  {formatDate(message.date)}
                </span>
              </div>
            </button>
            {ouvert === message.id && (
              <div className="flex flex-col gap-2 px-4 pb-3 pl-8">
                <p className="text-xs text-[#001314]/60">{message.corps}</p>
                {message.type === "preparation" && message.demande_preparation_id && (
                  <Link
                    href={`/vendeur/preparations/${message.demande_preparation_id}`}
                    className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-[#0B3D91] hover:underline"
                  >
                    Ouvrir le bon de préparation
                    <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
