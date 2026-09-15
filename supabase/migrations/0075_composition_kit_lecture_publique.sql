-- SacAdo — lecture publique de composition_kit (migration 0073). Sans policy,
-- la fiche produit d'un kit ne peut pas afficher "Ce que contient le kit"
-- côté client (clé anon) : le bloc composition renvoie une liste vide en
-- silence (RLS activée par défaut sur les nouvelles tables de ce projet, sans
-- policy = accès refusé, pas d'erreur). Constaté en testant la fiche produit
-- du Kit Découverte Arduino après la migration 0073.
-- À exécuter après 0074. Idempotent.
alter table composition_kit enable row level security;

drop policy if exists "Lecture publique composition_kit" on composition_kit;
create policy "Lecture publique composition_kit" on composition_kit for select using (true);
