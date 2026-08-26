-- SacAdo — décrément de stock à la commande (Lot 4)
-- À exécuter après 0001_schema.sql et 0002_seed.sql.

create function decrementer_stock_produit(p_produit_id bigint, p_quantite integer)
returns void as $$
begin
  update produits
  set stock = greatest(stock - p_quantite, 0)
  where id = p_produit_id;
end;
$$ language plpgsql security definer;

create function decrementer_stock_variante(p_variante_id bigint, p_quantite integer)
returns void as $$
begin
  update produit_variantes
  set stock = greatest(stock - p_quantite, 0)
  where id = p_variante_id;
end;
$$ language plpgsql security definer;

-- Ces fonctions passent le stock à 0 minimum et déclenchent les triggers
-- existants (trg_produits_statut / trg_produit_variantes_statut) qui basculent
-- automatiquement le statut à "epuise" le cas échéant.

-- Supabase accorde par défaut des "default privileges" à anon/authenticated
-- (pas seulement à PUBLIC) sur les nouveaux objets du schéma public : un simple
-- "revoke ... from public" ne suffit donc pas. Sans ces revokes explicites,
-- n'importe qui avec la clé anon pourrait appeler ces RPC directement via
-- l'API REST et vider le stock d'un produit sans jamais passer par une
-- commande. Seul le serveur (service_role) doit pouvoir les exécuter.
revoke execute on function decrementer_stock_produit(bigint, integer) from public, anon, authenticated;
revoke execute on function decrementer_stock_variante(bigint, integer) from public, anon, authenticated;
grant execute on function decrementer_stock_produit(bigint, integer) to service_role;
grant execute on function decrementer_stock_variante(bigint, integer) to service_role;
