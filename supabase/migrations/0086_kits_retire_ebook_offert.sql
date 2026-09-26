-- Correction v7 des kits : les ebooks ne sont pas encore prêts, retrait de la
-- mention « Ebook offert » partout, y compris le champ qui la portait.
alter table kits drop column if exists ebook_offert;

-- L'import (scripts/import-kits.mjs) doit upsert sur `slug`, mais
-- `kits_slug_key` (0085) est un index unique PARTIEL (where slug is not
-- null) : Postgres ne l'utilise pas comme cible ON CONFLICT (slug) sans
-- clause WHERE correspondante, ce que le client Supabase ne sait pas
-- exprimer. Remplacé par une contrainte unique classique — tous les kits
-- importés ont désormais toujours un slug.
drop index if exists kits_slug_key;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kits_slug_unique') then
    alter table kits add constraint kits_slug_unique unique (slug);
  end if;
end $$;
