"use client";

import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import { getMessagesParTelephone, marquerMessageLu } from "@/lib/moi/actions";
import { IdentitePrompt } from "@/components/moi/identite-prompt";
import { EmptyState } from "@/components/ui/empty-state";
import type { Message } from "@/lib/supabase/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessagesPage() {
  const { identite } = useIdentite();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [ouvert, setOuvert] = useState<number | null>(null);

  useEffect(() => {
    if (!identite) return;
    getMessagesParTelephone(identite.telephone)
      .then(setMessages)
      .finally(() => setLoading(false));
  }, [identite]);

  const ouvrir = async (message: Message) => {
    setOuvert((current) => (current === message.id ? null : message.id));
    if (!message.lu && identite) {
      await marquerMessageLu(message.id, identite.telephone);
      setMessages((current) => current.map((m) => (m.id === message.id ? { ...m, lu: true } : m)));
    }
  };

  return (
    <div className="animate-fade-in-up flex flex-col gap-4 px-4 py-4">
      <h1 className="font-heading text-xl font-bold text-ink">Boîte de réception</h1>

      {!identite ? (
        <IdentitePrompt contexte="vos messages" />
      ) : loading ? (
        <p className="text-sm text-ink/50">Chargement…</p>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Aucun message pour l'instant"
          description="Les mises à jour de tes commandes apparaîtront ici."
        />
      ) : (
        <div className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated">
          {messages.map((message) => (
            <button
              key={message.id}
              type="button"
              onClick={() => ouvrir(message)}
              className="flex flex-col gap-1 px-4 py-3 text-left active:bg-ink/5"
            >
              <div className="flex items-center gap-2">
                {!message.lu && (
                  <span className="size-2 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                )}
                <span className={`flex-1 text-sm ${message.lu ? "text-ink/70" : "font-semibold text-ink"}`}>
                  {message.titre}
                </span>
                <span className="shrink-0 text-[11px] text-ink/40">{formatDate(message.date)}</span>
              </div>
              {ouvert === message.id && <p className="pl-4 text-xs text-ink/60">{message.corps}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
