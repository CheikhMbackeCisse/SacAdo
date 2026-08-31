"use client";

import { createBrowserClient } from "@supabase/ssr";

// Client Supabase navigateur avec session stockée en COOKIES (via @supabase/ssr),
// donc lisible côté serveur (proxy, Server Components, Route Handlers). Utilisé
// pour l'espace vendeur : "Continuer avec Google" doit déclencher la redirection
// OAuth depuis le navigateur, puis le callback serveur échange le code.
//
// Le singleton `lib/supabase/client.ts` (session en localStorage) reste pour le
// storefront public — ne pas le confondre avec celui-ci.
let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}
