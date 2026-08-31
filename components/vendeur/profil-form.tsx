"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { enregistrerProfilVendeur } from "@/lib/vendeur/auth-actions";

const INK = "#001314";
const ACTION = "#E07B39";

export function ProfilForm({ emailCompte }: { emailCompte: string }) {
  const router = useRouter();
  const [nomBoutique, setNomBoutique] = useState("");
  const [contactNom, setContactNom] = useState("");
  const [contactTelephone, setContactTelephone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await enregistrerProfilVendeur({ nomBoutique, contactNom, contactTelephone });
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push("/vendeur");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[#001314]/10 bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="font-heading text-lg font-bold" style={{ color: INK }}>
          Votre boutique
        </h1>
        <p className="text-xs" style={{ color: `${INK}80` }}>
          Dernière étape avant d&apos;accéder à votre espace ({emailCompte}).
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium" style={{ color: `${INK}99` }}>
          Nom de la boutique
        </span>
        <input
          required
          value={nomBoutique}
          onChange={(event) => setNomBoutique(event.target.value)}
          placeholder="Librairie Teranga"
          className="rounded-xl border border-[#001314]/15 px-3 py-2.5 text-sm outline-none focus:border-[#0B3D91] focus:ring-2 focus:ring-[#0B3D91]/25"
          style={{ color: INK }}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium" style={{ color: `${INK}99` }}>
          Personne à contacter <span className="font-normal">(facultatif)</span>
        </span>
        <input
          value={contactNom}
          onChange={(event) => setContactNom(event.target.value)}
          className="rounded-xl border border-[#001314]/15 px-3 py-2.5 text-sm outline-none focus:border-[#0B3D91] focus:ring-2 focus:ring-[#0B3D91]/25"
          style={{ color: INK }}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium" style={{ color: `${INK}99` }}>
          Téléphone <span className="font-normal">(facultatif)</span>
        </span>
        <input
          type="tel"
          inputMode="tel"
          value={contactTelephone}
          onChange={(event) => setContactTelephone(event.target.value)}
          placeholder="77 123 45 67"
          className="rounded-xl border border-[#001314]/15 px-3 py-2.5 text-sm outline-none focus:border-[#0B3D91] focus:ring-2 focus:ring-[#0B3D91]/25"
          style={{ color: INK }}
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
        style={{ backgroundColor: ACTION, color: INK }}
      >
        {submitting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : "Continuer"}
      </button>
    </form>
  );
}
