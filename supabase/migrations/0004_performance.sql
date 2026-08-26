-- SacAdo — montée en charge & robustesse (avant mise en ligne)
-- À exécuter après 0001, 0002, 0003.

-- ============================================================================
-- INDEX MANQUANTS
-- ============================================================================
-- produits.categorie, commandes.client_id/statut, commande_items.produit_id et
-- produit_variantes.produit_id ont déjà un index depuis le Lot 1 (0001_schema.sql).
-- clients.telephone a déjà un index implicite via sa contrainte UNIQUE.
-- Il ne manquait que produits.statut (filtré en permanence : catalogue public,
-- alertes stock admin).
create index if not exists idx_produits_statut on produits (statut);

-- ============================================================================
-- ANTI DOUBLE-COMMANDE (clic multiple sur "Confirmer", requête rejouée)
-- ============================================================================
-- Référence générée une fois côté client (crypto.randomUUID()) au chargement
-- du checkout. creer_commande() ci-dessous renvoie la commande existante si
-- cette référence a déjà été utilisée, au lieu d'en recréer une.
alter table commandes add column if not exists client_reference text unique;

-- ============================================================================
-- CRÉATION DE COMMANDE ATOMIQUE (remplace les RPC de décrément du Lot 4)
-- ============================================================================
-- Problème corrigé : passerCommande() vérifiait le stock en lisant les lignes
-- JS AVANT de créer la commande, puis décrémentait le stock APRÈS coup, sans
-- lien transactionnel entre les deux. Deux clients commandant en même temps le
-- dernier exemplaire d'un article passaient tous les deux la vérification et
-- obtenaient chacun une commande confirmée pour un article qu'un seul avait
-- réellement en stock (survente silencieuse, sans erreur ni stock négatif).
--
-- Ici, toute la séquence (verrouillage + vérification + décrément + insertion
-- commande/commande_items) tourne dans une seule transaction Postgres. Le
-- verrou "for update" bloque la deuxième commande concurrente jusqu'à ce que
-- la première ait fini ; elle relit alors un stock à jour et échoue proprement
-- si besoin (au lieu de survendre). Le tri des lignes par produit_id/variante_id
-- avant verrouillage évite les interblocages (deadlocks) entre deux commandes
-- qui contiendraient les mêmes articles dans un ordre différent.
drop function if exists decrementer_stock_produit(bigint, integer);
drop function if exists decrementer_stock_variante(bigint, integer);

create function creer_commande(
  p_client_id bigint,
  p_zone_id bigint,
  p_adresse text,
  p_mode_livraison text,
  p_frais_livraison integer,
  p_sous_total integer,
  p_total integer,
  p_reference text,
  p_lignes jsonb -- [{"produit_id":1,"variante_id":null,"quantite":2,"prix_unitaire":600}, ...]
)
returns bigint as $$
declare
  v_commande_id bigint;
  v_ligne jsonb;
  v_stock integer;
  v_quantite integer;
begin
  -- Idempotent : une commande déjà créée avec cette référence est renvoyée
  -- telle quelle, sans retoucher au stock (rejoue en sécurité un clic double
  -- ou une requête réseau retentée).
  if p_reference is not null then
    select id into v_commande_id from commandes where client_reference = p_reference;
    if found then
      return v_commande_id;
    end if;
  end if;

  for v_ligne in
    select value from jsonb_array_elements(p_lignes) as t(value)
    order by (value->>'produit_id')::bigint, (value->>'variante_id')::bigint nulls first
  loop
    v_quantite := (v_ligne->>'quantite')::integer;

    if (v_ligne->>'variante_id') is not null then
      select stock into v_stock from produit_variantes
        where id = (v_ligne->>'variante_id')::bigint for update;
      if v_stock is null or v_stock < v_quantite then
        raise exception 'STOCK_INSUFFISANT:%', (v_ligne->>'produit_id');
      end if;
      update produit_variantes set stock = stock - v_quantite
        where id = (v_ligne->>'variante_id')::bigint;
    else
      select stock into v_stock from produits
        where id = (v_ligne->>'produit_id')::bigint for update;
      if v_stock is null or v_stock < v_quantite then
        raise exception 'STOCK_INSUFFISANT:%', (v_ligne->>'produit_id');
      end if;
      update produits set stock = stock - v_quantite
        where id = (v_ligne->>'produit_id')::bigint;
    end if;
  end loop;

  insert into commandes (client_id, zone_id, adresse, mode_livraison, frais_livraison, sous_total, total, client_reference)
  values (p_client_id, p_zone_id, p_adresse, p_mode_livraison, p_frais_livraison, p_sous_total, p_total, p_reference)
  returning id into v_commande_id;

  insert into commande_items (commande_id, produit_id, variante_id, quantite, prix_unitaire)
  select
    v_commande_id,
    (l->>'produit_id')::bigint,
    (l->>'variante_id')::bigint,
    (l->>'quantite')::integer,
    (l->>'prix_unitaire')::integer
  from jsonb_array_elements(p_lignes) as l;

  return v_commande_id;
end;
$$ language plpgsql security definer;

revoke execute on function creer_commande(bigint, bigint, text, text, integer, integer, integer, text, jsonb)
  from public, anon, authenticated;
grant execute on function creer_commande(bigint, bigint, text, text, integer, integer, integer, text, jsonb)
  to service_role;
