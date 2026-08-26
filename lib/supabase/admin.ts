import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client "service_role" : contourne le RLS (voir supabase/README.md). Le
// package "server-only" fait échouer le build si ce fichier est importé,
// même transitivement, depuis un composant "use client" — c'est la seule
// façon dont clients/commandes/commande_items/messages doivent être touchés.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY manquante : renseigne-la dans .env.local " +
      "(Project Settings > API > service_role). Ne JAMAIS la préfixer NEXT_PUBLIC_.",
  );
}

export const supabaseAdmin = createClient(supabaseUrl ?? "", serviceRoleKey ?? "", {
  auth: { persistSession: false },
});
