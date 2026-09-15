-- SacAdo — Page Préférences (TACHE_nettoyage_carrousel_preferences.md §C.3)
-- À exécuter APRÈS 0079, dans le SQL Editor Supabase. Idempotente (peut être
-- relancée) SAUF le "rename" initial : s'il a déjà été fait, l'ancien nom
-- n'existe plus et le rename échoue silencieusement grâce au bloc do $$.
--
-- Étend la table de préférences existante (notifications push) plutôt que
-- d'en créer une seconde : mêmes lignes, mêmes clés (client_id), plus de
-- colonnes pour l'affichage, les recommandations et la livraison par défaut.
--
-- Écart avec le document de tâche : `localite_defaut_id`/`lieu_special_defaut_id`
-- sont des `bigint` (pas `uuid`) — ce sont les vrais types de `localites.id` et
-- `lieux_speciaux.id`. Un seul des deux est renseigné à la fois, même
-- convention que `commandes.localite_id`/`lieu_special_id`.

do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'preferences_notifications')
     and not exists (select 1 from information_schema.tables where table_name = 'preferences_utilisateur') then
    alter table preferences_notifications rename to preferences_utilisateur;
  end if;
end $$;

alter table preferences_utilisateur add column if not exists theme text not null default 'systeme';
do $$
begin
  alter table preferences_utilisateur add constraint preferences_utilisateur_theme_check
    check (theme in ('clair', 'sombre', 'systeme'));
exception
  when duplicate_object then null;
end $$;

alter table preferences_utilisateur add column if not exists taille_texte text not null default 'normale';
do $$
begin
  alter table preferences_utilisateur add constraint preferences_utilisateur_taille_texte_check
    check (taille_texte in ('normale', 'grande', 'tres_grande'));
exception
  when duplicate_object then null;
end $$;

alter table preferences_utilisateur add column if not exists personnalisation boolean not null default true;
alter table preferences_utilisateur add column if not exists localite_defaut_id bigint references localites (id) on delete set null;
alter table preferences_utilisateur add column if not exists lieu_special_defaut_id bigint references lieux_speciaux (id) on delete set null;
alter table preferences_utilisateur add column if not exists precision_livreur text;

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select * from preferences_utilisateur limit 20;
