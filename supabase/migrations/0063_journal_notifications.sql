-- SacAdo — Journal des notifications, tous canaux (TACHE_notifications_client.md §9)
-- À exécuter APRÈS 0062. Idempotente.
--
-- Un enregistrement léger par notification effectivement traitée (pas le
-- contenu — ça, c'est `messages` / `envois_whatsapp`) : sert uniquement au
-- tableau de bord admin (taux d'échec push, bloqués par préférence…).

create table if not exists journal_notifications (
  id          bigint generated always as identity primary key,
  client_id   bigint references clients (id) on delete set null,
  commande_id bigint references commandes (id) on delete set null,
  canal       text not null check (canal in ('push', 'whatsapp', 'inbox')),
  type        text not null,               -- code du modèle, ou 'libre' (WhatsApp)
  statut      text not null check (statut in ('envoye', 'echec', 'differe', 'bloque_preference')),
  detail      text,
  cree_le     timestamptz not null default now()
);

create index if not exists idx_journal_notifications_recent
  on journal_notifications (cree_le desc);
create index if not exists idx_journal_notifications_canal
  on journal_notifications (canal, statut, cree_le desc);

alter table journal_notifications enable row level security;
-- Aucune policy publique : lecture/écriture réservées au service_role.

-- Le trigger de suivi de commande (0058) journalise aussi la boîte de
-- réception : chaque message inséré = une ligne 'inbox'/'envoye'.
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

  if v_code is null then
    return new;
  end if;

  select titre, contenu into v_titre, v_contenu
    from modeles_messages
   where code = v_code and canal = 'inbox' and actif;

  v_montant := replace(to_char(new.total, 'FM999,999,999,999'), ',', ' ');

  if v_contenu is null then
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

  insert into journal_notifications (client_id, commande_id, canal, type, statut)
  values (new.client_id, new.id, 'inbox', v_code, 'envoye');

  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select canal, statut, count(*) from journal_notifications
--  where cree_le > now() - interval '7 days' group by canal, statut order by 1, 2;
