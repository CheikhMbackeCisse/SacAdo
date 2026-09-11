-- SacAdo — Boîte de réception : statut « probleme » + messages tirés des modèles
-- (TACHE_notifications_client.md §5-§6). À exécuter APRÈS 0057. Idempotente.
--
-- 1. Nouveau statut de commande 'probleme' (souci sur la commande : article
--    indisponible chez le fournisseur, etc.). État d'exception — l'admin y
--    passe pour prévenir le client, puis revient à 'preparation'/'livraison'
--    ou termine en 'livree'.
-- 2. `messages` gagne `lien` (destination au clic) et `envoi_differe` (file des
--    heures calmes, lot B4).
-- 3. Le message de suivi n'est plus écrit en dur : il est tiré de
--    `modeles_messages` (canal 'inbox'), éditable depuis /admin/modeles.

-- 1. Statut 'probleme'.
alter table commandes drop constraint if exists commandes_statut_check;
alter table commandes
  add constraint commandes_statut_check
  check (statut in ('paiement_en_attente', 'recue', 'preparation', 'livraison', 'livree', 'probleme'));

-- 2. Colonnes messages.
alter table messages add column if not exists lien text;
alter table messages add column if not exists envoi_differe boolean not null default false;

create index if not exists idx_messages_client_lu on messages (client_id, lu, date desc);

-- 3. Trigger : message de suivi tiré du modèle 'inbox' correspondant au statut.
create or replace function notify_commande_statut() returns trigger as $$
declare
  v_code    text;
  v_titre   text;
  v_contenu text;
  v_montant text;
begin
  if tg_op = 'UPDATE' and new.statut = old.statut then
    return new;
  end if;

  v_code := case new.statut
    when 'recue'       then 'commande_confirmee'
    when 'preparation' then 'commande_preparation'
    when 'livraison'   then 'commande_route'
    when 'livree'      then 'commande_livree'
    when 'probleme'    then 'commande_probleme'
    else null
  end;

  -- 'paiement_en_attente' et tout statut non mappé : aucun message.
  if v_code is null then
    return new;
  end if;

  select titre, contenu into v_titre, v_contenu
    from modeles_messages
   where code = v_code and canal = 'inbox' and actif;

  -- Montant groupé façon française ("18 500"), indépendant de la locale du serveur.
  v_montant := replace(to_char(new.total, 'FM999,999,999,999'), ',', ' ');

  if v_contenu is null then
    -- Modèle absent ou désactivé : message minimal, jamais rien.
    v_titre   := 'Mise à jour de ta commande';
    v_contenu := 'Ta commande n°' || new.id || ' a changé de statut.';
  else
    v_contenu := replace(v_contenu, '{numero_commande}', new.id::text);
    v_contenu := replace(v_contenu, '{montant}', v_montant);
    v_contenu := replace(v_contenu, '{localite}', coalesce(new.localite_nom, 'ta localité'));
    v_contenu := replace(v_contenu, '{prenom}', '');
    v_contenu := replace(v_contenu, '{lien_produit}', '');
    v_contenu := replace(v_contenu, '{lien_commande}', '');
    v_contenu := replace(v_contenu, '{lien}', '');
    v_contenu := replace(v_contenu, '{articles}', 'un article');
  end if;

  insert into messages (client_id, type, titre, corps, lien)
  values (
    new.client_id,
    'commande',
    coalesce(v_titre, 'Mise à jour de ta commande'),
    v_contenu,
    '/suivi/' || new.id
  );

  return new;
end;
$$ language plpgsql;

-- Le trigger trg_commandes_notify existe déjà (0001) et pointe sur cette
-- fonction : rien à recréer.

-- 4. Purge de la boîte de réception à 90 jours (TACHE_notifications_client.md §5).
do $$
begin
  perform cron.unschedule('purge_messages');
exception when others then
  null;
end $$;

select cron.schedule('purge_messages', '30 3 * * *',
  $$ delete from messages where date < now() - interval '90 days'; $$);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select conname, pg_get_constraintdef(oid) from pg_constraint where conname = 'commandes_statut_check';
-- select jobname, schedule, active from cron.job where jobname = 'purge_messages';
-- Test : passer une commande de 'recue' à 'preparation' dans l'admin, vérifier
-- qu'une ligne apparaît dans `messages` avec le texte du modèle inbox.
