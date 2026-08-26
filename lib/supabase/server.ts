import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client Supabase côté serveur, lié aux cookies de session (clé anon : c'est
// l'auth normale de Supabase, pas service_role). Utilisé pour savoir QUI est
// connecté (admin ou personne) dans les Server Components / Server Actions
// de l'espace /admin.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Appelé depuis le rendu d'un Server Component : la session sera
            // rafraîchie par le middleware sur la requête suivante.
          }
        },
      },
    },
  );
}
