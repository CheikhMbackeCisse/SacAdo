-- SacAdo — étend l'énumération unite_vente (migration 0083) avec 'ramette'
-- (lot papiers, PROMPT_PAPIERS.md). À exécuter APRÈS 0111. Idempotente.
alter table produits drop constraint if exists produits_unite_vente_check;
alter table produits add constraint produits_unite_vente_check
  check (unite_vente in ('unite', 'paquet', 'lot', 'ramette', 'inconnu'));
