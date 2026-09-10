-- SacAdo — Recherche produit v2 (TACHE_recherche_produits_v2.md)
-- À exécuter dans le SQL Editor Supabase, APRÈS 0031.
-- Additive + idempotente (create ... if not exists / create or replace /
-- drop function if exists). Peut être rejouée.
--
-- Trois comportements visés :
--   1. Chaque mot tapé est OBLIGATOIRE (ET). Ajouter un mot réduit toujours
--      le nombre de résultats.
--   2. Le nom du produit prime : un match sur la désignation passe devant un
--      match qui ne vient que de la catégorie (champ `type_resultat`).
--   3. Table de synonymes : « bic » -> stylo, « flash » -> cle usb, etc.

-- ============================================================================
-- 1. Extensions + enveloppe unaccent IMMUTABLE
-- ============================================================================
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- `unaccent` du contrib n'est pas marquée IMMUTABLE (elle dépend d'un
-- dictionnaire), donc inutilisable telle quelle dans une colonne indexée ou un
-- trigger déterministe. La forme à 2 arguments avec le dico explicite l'est.
-- `unaccent` non qualifié : résolu par le search_path, comme word_similarity /
-- levenshtein ailleurs dans le projet (l'extension peut être en `public` ou
-- `extensions` selon l'install Supabase).
create or replace function public.unaccent_immutable(text)
returns text
language sql
immutable
strict
parallel safe
as $$ select unaccent('unaccent', $1) $$;

-- ============================================================================
-- 2. Colonnes d'index sur `produits`
-- ============================================================================
-- `mots_cles`      : champ libre éditable en admin (cas particuliers).
-- `nom_normalise`  : la désignation seule, minuscule + sans accents.
--                    Sert à distinguer un match « sur le nom » d'un match large.
-- `recherche_texte`: nom + description + catégorie + sous-catégorie +
--                    sous-sous-catégorie + mots_cles. Le filet large.
alter table produits add column if not exists mots_cles text;
alter table produits add column if not exists nom_normalise text;
alter table produits add column if not exists recherche_texte text;

-- ============================================================================
-- 3. Trigger de remplissage
-- ============================================================================
-- On ne peut pas utiliser de colonne générée : elle ne peut pas lire les
-- tables `categories` / `sous_categories` / `sous_sous_categories`.
create or replace function public.maj_index_recherche()
returns trigger
language plpgsql
as $$
declare
  v_cat   text;
  v_sous  text;
  v_ssous text;
begin
  select c.nom  into v_cat   from categories c            where c.id = new.categorie_id;
  select s.nom  into v_sous  from sous_categories s        where s.id = new.sous_categorie_id;
  select ss.nom into v_ssous from sous_sous_categories ss  where ss.id = new.sous_sous_categorie_id;

  new.nom_normalise := public.unaccent_immutable(lower(coalesce(new.nom, '')));

  new.recherche_texte := public.unaccent_immutable(lower(
      coalesce(new.nom, '')         || ' ' ||
      coalesce(new.description, '')  || ' ' ||
      coalesce(v_cat, '')           || ' ' ||
      coalesce(v_sous, '')          || ' ' ||
      coalesce(v_ssous, '')         || ' ' ||
      coalesce(new.mots_cles, '')
  ));
  return new;
end $$;

drop trigger if exists produits_index_recherche on produits;
create trigger produits_index_recherche
  before insert or update on produits
  for each row execute function public.maj_index_recherche();

-- Remplir l'existant (déclenche le trigger ci-dessus ; ne touche pas au stock
-- donc n'active pas le trigger de statut).
update produits set nom = nom;

-- ============================================================================
-- 4. Index trigram
-- ============================================================================
create index if not exists produits_nom_trgm
  on produits using gin (nom_normalise gin_trgm_ops);
create index if not exists produits_recherche_trgm
  on produits using gin (recherche_texte gin_trgm_ops);

-- ============================================================================
-- 5. Table de synonymes (par groupes : tous les termes d'un groupe sont
--    interchangeables dans les deux sens)
-- ============================================================================
create table if not exists synonymes (
  id bigserial primary key,
  groupe int not null,
  terme text not null unique
);
create index if not exists synonymes_groupe_idx on synonymes (groupe);
create index if not exists synonymes_terme_idx on synonymes (terme);

alter table synonymes enable row level security;
drop policy if exists "Lecture publique synonymes" on synonymes;
create policy "Lecture publique synonymes" on synonymes
  for select using (true);

-- Contenu initial. Termes en minuscules et sans accents, comme les colonnes
-- d'index. `on conflict do nothing` -> rejouable.
insert into synonymes (groupe, terme) values
-- Papeterie
(1,'bic'),(1,'stylo'),(1,'stylo bille'),(1,'stylos'),
(2,'crayon'),(2,'crayon a papier'),(2,'crayon papier'),(2,'crayon noir'),
(3,'crayon de couleur'),(3,'crayons couleur'),(3,'crayons de couleurs'),
(4,'gomme'),(4,'efface'),
(5,'taille crayon'),(5,'taille-crayon'),(5,'aiguisoir'),
(6,'correcteur'),(6,'blanco'),(6,'tipex'),(6,'tipp ex'),(6,'effaceur'),
(7,'surligneur'),(7,'stabilo'),(7,'fluo'),(7,'marqueur fluo'),
(8,'marqueur'),(8,'feutre'),(8,'velleda'),(8,'marqueur tableau'),
(9,'cahier'),(9,'cahiers'),
(10,'protege cahier'),(10,'protege-cahier'),(10,'couverture cahier'),
(11,'chemise'),(11,'sous chemise'),(11,'chemise cartonnee'),(11,'porte document'),
(12,'classeur'),(12,'trieur'),(12,'parapheur'),
(13,'feuille double'),(13,'copie double'),(13,'feuilles doubles'),
(14,'feuille simple'),(14,'copie simple'),(14,'feuilles simples'),
(15,'ramette'),(15,'rame'),(15,'papier a4'),(15,'papier ramette'),
(16,'colle'),(16,'baton de colle'),(16,'uhu'),(16,'gluestick'),
(17,'regle'),(17,'double decimetre'),(17,'reglet'),
(18,'compas'),(18,'boite de geometrie'),(18,'kit geometrie'),
(19,'equerre'),(19,'rapporteur'),
(20,'calculatrice'),(20,'calculette'),(20,'casio'),(20,'machine a calculer'),
(21,'trousse'),(21,'plumier'),
(22,'cartable'),(22,'sac a dos'),(22,'sac d ecole'),(22,'sac scolaire'),(22,'sacado'),
(23,'ardoise'),(23,'ardoise velleda'),(23,'tableau ardoise'),
(24,'craie'),(24,'craies'),
(25,'agenda'),(25,'carnet de texte'),(25,'cahier de texte'),
(26,'repertoire'),(26,'carnet repertoire'),
(27,'dictionnaire'),(27,'larousse'),(27,'robert'),
(28,'blouse'),(28,'tablier'),(28,'blouse d ecole'),
(29,'gouache'),(29,'peinture'),(29,'pinceau'),(29,'boite de peinture'),
(30,'ciseaux'),(30,'paire de ciseaux'),
-- Informatique
(40,'ordinateur portable'),(40,'ordi'),(40,'laptop'),(40,'pc portable'),(40,'notebook'),
(41,'ordinateur de bureau'),(41,'pc bureau'),(41,'unite centrale'),(41,'tour'),(41,'desktop'),
(42,'ecran'),(42,'moniteur'),(42,'ecran pc'),(42,'dalle'),
(43,'clavier'),(43,'keyboard'),(43,'clavier azerty'),
(44,'souris'),(44,'mouse'),(44,'souris optique'),
(45,'cle usb'),(45,'clef usb'),(45,'flash'),(45,'flash disk'),(45,'flash disque'),(45,'usb'),
(46,'disque dur'),(46,'hdd'),(46,'disque externe'),(46,'disque dur externe'),
(47,'ssd'),(47,'disque ssd'),(47,'nvme'),
(48,'ram'),(48,'barrette'),(48,'barrette memoire'),(48,'memoire vive'),
(49,'casque'),(49,'ecouteur'),(49,'ecouteurs'),(49,'kit main libre'),
(50,'webcam'),(50,'camera pc'),
(51,'onduleur'),(51,'ups'),(51,'stabilisateur'),
(52,'chargeur'),(52,'adaptateur secteur'),(52,'alimentation'),(52,'bloc alimentation'),
(53,'cable hdmi'),(53,'hdmi'),
(54,'multiprise'),(54,'rallonge'),(54,'prise multiple'),
(55,'tablette'),(55,'tablette tactile'),(55,'ipad'),
(56,'sacoche'),(56,'housse'),(56,'sac ordinateur'),(56,'sac pc'),
(57,'cle wifi'),(57,'adaptateur wifi'),(57,'dongle wifi'),
-- Impression
(60,'imprimante'),(60,'printer'),(60,'imprimeur'),
(61,'cartouche'),(61,'encre'),(61,'cartouche d encre'),(61,'recharge encre'),
(62,'toner'),(62,'tambour'),(62,'cartouche laser'),
(63,'photocopieuse'),(63,'photocopieur'),(63,'copieur'),(63,'machine a photocopier'),
(64,'scanner'),(64,'numeriseur'),
(65,'videoprojecteur'),(65,'projecteur'),(65,'retroprojecteur'),(65,'data show'),(65,'datashow'),
(66,'imprimante 3d'),(66,'impression 3d'),(66,'filament'),(66,'pla'),
-- Electronique
(70,'arduino'),(70,'carte arduino'),
(71,'raspberry pi'),(71,'raspberry'),(71,'rpi'),(71,'framboise'),
(72,'capteur'),(72,'sensor'),(72,'module capteur'),
(73,'servomoteur'),(73,'servo'),(73,'moteur servo'),
(74,'breadboard'),(74,'plaque d essai'),(74,'plaque de prototypage'),(74,'platine essai'),
(75,'fil dupont'),(75,'jumper'),(75,'cable jumper'),(75,'fils de connexion'),
(76,'resistance'),(76,'resistances'),
(77,'led'),(77,'diode'),(77,'diode electroluminescente'),
(78,'ecran lcd'),(78,'afficheur'),(78,'oled'),(78,'ecran oled'),
(79,'fer a souder'),(79,'soudure'),(79,'etain'),(79,'station de soudage'),
(80,'multimetre'),(80,'testeur'),(80,'voltmetre'),
(81,'pile'),(81,'batterie'),(81,'accumulateur'),
(82,'kit de demarrage'),(82,'starter kit'),(82,'kit debutant'),
(83,'esp32'),(83,'esp'),(83,'nodemcu'),(83,'esp8266'),
(84,'drone'),(84,'quadricoptere'),
-- Sport
(90,'survetement'),(90,'survet'),(90,'jogging'),(90,'training'),(90,'tenue de sport'),
(91,'chaussures de sport'),(91,'basket'),(91,'baskets'),(91,'tennis'),(91,'sneakers'),
(92,'maillot'),(92,'tricot'),(92,'t-shirt sport'),(92,'maillot eps'),
(93,'ballon'),(93,'balle'),(93,'ballon de foot'),
(94,'dossard'),(94,'chasuble'),
(95,'corde a sauter'),(95,'corde'),
(96,'gourde'),(96,'bouteille'),(96,'bouteille d eau')
on conflict (terme) do nothing;

-- ============================================================================
-- 6. Journal des recherches sans résultat
-- ============================================================================
create table if not exists recherches_sans_resultat (
  id bigserial primary key,
  terme text not null,
  utilisateur_id uuid,
  cree_le timestamptz not null default now()
);
create index if not exists recherches_sans_resultat_cree_le_idx
  on recherches_sans_resultat (cree_le desc);

-- RLS activée SANS policy : ni lecture ni écriture pour anon/authenticated.
-- L'écriture se fait côté serveur (service_role) et l'admin lit via service_role.
alter table recherches_sans_resultat enable row level security;

-- ============================================================================
-- 7. Fonction de recherche
-- ============================================================================
-- Ancienne signature (0010/0031) remplacée : le retour porte maintenant
-- `type_resultat` + `score`, impossible avec `returns setof produits`.
drop function if exists rechercher_produits(text, integer, integer);

create or replace function rechercher_produits(
  terme text,
  limite integer default 24
)
returns table (
  id bigint,
  nom text,
  prix integer,
  photo text,
  statut text,
  type_resultat text,
  score real
)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
  v_terme text;
  v_mots  text[];
begin
  -- 1. Normaliser : minuscules, sans accents, espaces multiples réduits.
  v_terme := btrim(regexp_replace(
    public.unaccent_immutable(lower(coalesce(terme, ''))), '\s+', ' ', 'g'));

  -- 2. Moins de 2 caractères -> rien.
  if length(v_terme) < 2 then
    return;
  end if;

  -- 3. Découper en mots.
  v_mots := regexp_split_to_array(v_terme, ' ');

  -- 4-5. Variantes par mot (synonymes du même groupe, sinon le mot seul) ;
  -- on ne retient un produit que si CHAQUE mot tapé matche au moins une de
  -- ses variantes dans `recherche_texte` (le ET obligatoire).
  return query
  with variantes as (
    select m.mot,
           array_agg(distinct coalesce(s2.terme, m.mot)) as liste
    from unnest(v_mots) as m(mot)
    left join synonymes s1 on s1.terme = m.mot
    left join synonymes s2 on s2.groupe = s1.groupe
    group by m.mot
  ),
  retenus as (
    select
      p.id, p.nom, p.prix, p.photo, p.statut, p.nom_normalise,
      -- tous les mots tapés sont-ils présents DANS LE NOM ?
      not exists (
        select 1 from variantes v
        where not exists (
          select 1 from unnest(v.liste) as x(t)
          where p.nom_normalise like '%' || x.t || '%'
        )
      ) as tous_mots_dans_nom
    from produits p
    where not exists (
      select 1 from variantes v
      where not exists (
        select 1 from unnest(v.liste) as x(t)
        where p.recherche_texte like '%' || x.t || '%'
      )
    )
  )
  select
    r.id, r.nom, r.prix, r.photo, r.statut,
    case when r.tous_mots_dans_nom then 'nom' else 'categorie' end,
    (
        (case when r.nom_normalise like v_terme || '%' then 100 else 0 end)
      + (case when exists (
             select 1 from variantes v, unnest(v.liste) as x(t)
             where r.nom_normalise like x.t || '%'
                or r.nom_normalise like '% ' || x.t || '%'
           ) then 60 else 0 end)
      + (case when r.tous_mots_dans_nom then 40 else 10 end)
      + similarity(r.nom_normalise, v_terme) * 20
    )::real
  from retenus r
  order by 7 desc, (r.statut = 'dispo') desc, r.nom
  limit greatest(limite, 1);

  -- 6. Résultat vide -> seulement alors, passe tolérante aux fautes de frappe.
  if not found then
    return query
    select
      p.id, p.nom, p.prix, p.photo, p.statut,
      'nom'::text,
      (similarity(p.nom_normalise, v_terme) * 20)::real
    from produits p
    where similarity(p.nom_normalise, v_terme) > 0.25
    order by 7 desc, p.nom
    limit greatest(limite, 1);
  end if;
end $$;

revoke execute on function rechercher_produits(text, integer) from public;
grant execute on function rechercher_produits(text, integer) to anon, authenticated;

-- ============================================================================
-- Contrôles post-exécution (à lancer après la migration)
-- ============================================================================
-- select count(*) filter (where nom_normalise is not null) as remplis,
--        count(*) as total from produits;
-- select groupe, count(*) from synonymes group by groupe order by groupe;
-- select * from rechercher_produits('cahier', 10);
-- select * from rechercher_produits('arduno', 10);      -- passe tolérante
-- select id, nom, type_resultat, score from rechercher_produits('ordinateur portable', 20);
