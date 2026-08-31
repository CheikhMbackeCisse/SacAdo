"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { signInVendeur, signUpVendeur } from "@/lib/vendeur/auth-actions";

type Mode = "connexion" | "inscription";

const INK = "#001314";
const BRAND = "#0B3D91";
const ACTION = "#E07B39";

export function VendeurLoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomBoutique, setNomBoutique] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setInfo(null);

    const result =
      mode === "connexion"
        ? await signInVendeur(email, password)
        : await signUpVendeur(email, password, nomBoutique);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    if (mode === "inscription" && result.besoinVerificationEmail) {
      setInfo("Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.");
      setMode("connexion");
      setSubmitting(false);
      return;
    }

    router.push("/vendeur");
    router.refresh();
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const base = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${base}/vendeur/auth/callback` },
    });
    if (oauthError) {
      setError("La connexion Google est momentanément indisponible.");
      setGoogleLoading(false);
    }
    // En cas de succès, le navigateur est redirigé vers Google : rien à faire.
  };

  return (
    <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-[#001314]/10 bg-white p-6 shadow-sm">
      <div>
        <h1 className="font-heading text-lg font-bold" style={{ color: INK }}>
          Espace vendeur SacAdo
        </h1>
        <p className="text-xs" style={{ color: `${INK}80` }}>
          Vendez vos fournitures sur SacAdo. SacAdo gère la livraison.
        </p>
      </div>

      <div className="flex rounded-full bg-[#001314]/[0.06] p-1 text-sm">
        {(["connexion", "inscription"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
              setInfo(null);
            }}
            className="flex-1 rounded-full px-3 py-1.5 font-medium capitalize transition-colors"
            style={
              mode === m
                ? { backgroundColor: "#FFFFFF", color: INK, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
                : { color: `${INK}80` }
            }
          >
            {m === "connexion" ? "Connexion" : "Inscription"}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading || submitting}
        className="flex h-11 items-center justify-center gap-2.5 rounded-full border border-[#001314]/15 bg-white text-sm font-medium transition-colors hover:bg-[#001314]/[0.03] disabled:opacity-50"
        style={{ color: INK }}
      >
        {googleLoading ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <GoogleGlyph />
        )}
        Continuer avec Google
      </button>

      <div className="flex items-center gap-3 text-[11px]" style={{ color: `${INK}55` }}>
        <span className="h-px flex-1 bg-[#001314]/10" />
        ou
        <span className="h-px flex-1 bg-[#001314]/10" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {mode === "inscription" && (
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
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium" style={{ color: `${INK}99` }}>
            Email
          </span>
          <input
            required
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-xl border border-[#001314]/15 px-3 py-2.5 text-sm outline-none focus:border-[#0B3D91] focus:ring-2 focus:ring-[#0B3D91]/25"
            style={{ color: INK }}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium" style={{ color: `${INK}99` }}>
            Mot de passe
          </span>
          <input
            required
            type="password"
            minLength={8}
            autoComplete={mode === "connexion" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-xl border border-[#001314]/15 px-3 py-2.5 text-sm outline-none focus:border-[#0B3D91] focus:ring-2 focus:ring-[#0B3D91]/25"
            style={{ color: INK }}
          />
          {mode === "inscription" && (
            <span className="text-[11px]" style={{ color: `${INK}55` }}>
              8 caractères minimum.
            </span>
          )}
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {info && <p className="text-xs" style={{ color: BRAND }}>{info}</p>}

        <button
          type="submit"
          disabled={submitting || googleLoading}
          className="mt-1 flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
          style={{ backgroundColor: ACTION, color: INK }}
        >
          {submitting ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : mode === "connexion" ? (
            "Se connecter"
          ) : (
            "Créer mon compte vendeur"
          )}
        </button>
      </form>

      <Link href="/" className="text-center text-xs font-medium" style={{ color: `${INK}70` }}>
        Retour à la boutique
      </Link>
    </div>
  );
}

// Logo Google en SVG inline (CSP interdit les images tierces).
function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
