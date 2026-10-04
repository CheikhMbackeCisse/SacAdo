-- SacAdo — PROMPT_ADMIN_V2 Lot 2 : confirmation par appel + annulation qui
-- libère le stock. À exécuter APRÈS 0107, dans le SQL Editor Supabase.
-- Idempotente.
--
-- 1. commandes.appel_tentatives / appel_dernier_essai_le : compteur "Injoignable"
--    (PROMPT_ADMIN_V2 Lot 2) pour les commandes 'a_confirmer_appel'.
-- 2. annuler_commande_admin() : jusqu'ici, annuler une commande dans l'admin
--    ne libérait jamais le stock réservé à la création (seul le webhook Wave,
--    sur un paiement échoué, le faisait). Cette fonction relâche le stock —
--    kit-aware (relâche les composants, pas le kit lui-même, contrairement au
--    bug latent de la même logique en 0025) — puis passe la commande à
--    'annulee'. Idempotente : ne relâche jamais le stock deux fois.

-- 1. Compteur d'appels infructueux.
alter table commandes add column if not exists appel_tentatives integer not null default 0;
alter table commandes add column if not exists appel_dernier_essai_le timestamptz;

-- 2. Annulation admin avec libération de stock.
create or replace function annuler_commande_admin(p_commande_id bigint) returns text as $$
declare
  v_statut text;
  v_item record;
begin
  select statut into v_statut from commandes where id = p_commande_id for update;
  if not found then
    return 'commande_introuvable';
  end if;
  if v_statut = 'annulee' then
    return 'deja_annulee';
  end if;
  if v_statut in ('livraison', 'livree') then
    return 'trop_tard';
  end if;

  for v_item in
    select produit_id, variante_id, quantite from commande_items where commande_id = p_commande_id
  loop
    if v_item.variante_id is not null then
      update produit_variantes set stock = stock + v_item.quantite
        where id = v_item.variante_id;
    elsif exists (select 1 from produits where id = v_item.produit_id and est_kit) then
      update produits p set stock = p.stock + (ck.quantite * v_item.quantite)
        from composition_kit ck
        where ck.kit_id = v_item.produit_id and p.id = ck.composant_id;
    else
      update produits set stock = stock + v_item.quantite
        where id = v_item.produit_id;
    end if;
  end loop;

  update commandes set statut = 'annulee' where id = p_commande_id;
  return 'ok';
end;
$$ language plpgsql security definer;

revoke execute on function annuler_commande_admin(bigint) from public, anon, authenticated;
grant execute on function annuler_commande_admin(bigint) to service_role;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- 1. select column_name from information_schema.columns where table_name = 'commandes'
--    and column_name in ('appel_tentatives', 'appel_dernier_essai_le');
--    -> doit lister les deux colonnes.
-- 2. Prendre une commande 'a_confirmer_appel' avec un produit normal et un kit,
--    noter les stocks, appeler select annuler_commande_admin(<id>) -> 'ok',
--    statut passé à 'annulee', stock du produit et des composants du kit
--    remontés de la quantité commandée (le kit lui-même inchangé).
-- 3. Rappeler sur la même commande -> 'deja_annulee', stock inchangé.
