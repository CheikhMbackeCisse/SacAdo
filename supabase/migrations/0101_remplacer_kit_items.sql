-- SacAdo — CORRECTIONS_V16 Lot C : remplacement atomique du contenu d'un kit.
-- À exécuter dans le SQL Editor Supabase avant `node scripts/v16_import_kits.mjs
-- --apply`. Idempotent (create or replace). Un appel = une transaction Postgres
-- (delete + insert dans le corps de la fonction) : soit tout le contenu du kit
-- est remplacé, soit rien ne bouge en cas d'erreur.
create or replace function remplacer_kit_items(p_kit_id bigint, p_items jsonb)
returns void as $$
begin
  delete from kit_items where kit_id = p_kit_id;

  insert into kit_items (
    kit_id, produit_id, quantite_defaut, libelle_besoin, groupe_affichage,
    section, coche_defaut, ordre
  )
  select
    p_kit_id,
    (item->>'produit_id')::bigint,
    (item->>'quantite_defaut')::integer,
    item->>'libelle_besoin',
    item->>'groupe_affichage',
    item->>'section',
    (item->>'coche_defaut')::boolean,
    (item->>'ordre')::integer
  from jsonb_array_elements(p_items) as item;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select proname from pg_proc where proname = 'remplacer_kit_items';
-- -> doit exister.
