-- SacAdo — rate limiting basique (avant mise en ligne)
-- À exécuter après 0001 à 0004.

-- ============================================================================
-- RATE LIMITING (connexion admin, création de commande)
-- ============================================================================
-- Compteur générique par "clé" (ex: "login:1.2.3.4" ou "commande:1.2.3.4") sur
-- une fenêtre glissante simple. Stocké en base (pas en mémoire du serveur) car
-- Vercel exécute chaque requête sur une instance potentiellement différente —
-- un compteur en mémoire ne verrait jamais les tentatives des autres instances.
create table rate_limits (
  cle text primary key,
  compte integer not null default 1,
  fenetre_debut timestamptz not null default now()
);

create function verifier_limite(p_cle text, p_max integer, p_fenetre_secondes integer)
returns boolean as $$
declare
  v_row rate_limits%rowtype;
begin
  select * into v_row from rate_limits where cle = p_cle for update;

  if not found then
    insert into rate_limits (cle, compte, fenetre_debut) values (p_cle, 1, now());
    return true;
  end if;

  if now() - v_row.fenetre_debut > make_interval(secs => p_fenetre_secondes) then
    update rate_limits set compte = 1, fenetre_debut = now() where cle = p_cle;
    return true;
  end if;

  if v_row.compte >= p_max then
    return false;
  end if;

  update rate_limits set compte = compte + 1 where cle = p_cle;
  return true;
end;
$$ language plpgsql security definer;

-- Comme pour les autres RPC : seul service_role doit pouvoir l'appeler, sinon
-- n'importe qui pourrait fabriquer de fausses clés pour bloquer un autre
-- visiteur (déni de service ciblé), ou lire des compteurs.
revoke execute on function verifier_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function verifier_limite(text, integer, integer) to service_role;
alter table rate_limits enable row level security;
