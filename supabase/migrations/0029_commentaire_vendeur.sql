-- SacAdo — Espace vendeur : commentaire libre du vendeur sur son produit
-- À exécuter APRÈS 0028, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- ESPACE_VENDEUR_FORMULAIRE §2 : un champ texte libre où le vendeur laisse une
-- précision / question / remarque à l'attention de SacAdo. Facultatif, borné à
-- 2000 caractères (anti-saturation, en plus du contrôle serveur). Visible côté
-- admin dans la file de modération.

alter table produits
  add column if not exists commentaire_vendeur text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produits_commentaire_vendeur_len'
  ) then
    alter table produits add constraint produits_commentaire_vendeur_len
      check (commentaire_vendeur is null or char_length(commentaire_vendeur) <= 2000);
  end if;
end $$;
