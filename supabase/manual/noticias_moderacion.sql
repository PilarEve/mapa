-- ==============================================================================
-- NOTICIAS HISTÓRICAS: moderación administrativa - EJECUCIÓN MANUAL (SQL Editor)
-- NO se ejecuta automáticamente. Ejecutar en el SQL Editor, de una sola vez.
-- Requisitos: admin_setup.sql ya ejecutado. Revisar antes noticias_diagnostico.sql.
-- Es idempotente: se puede volver a ejecutar sin perder los rechazos.
--
-- Decisiones:
--  * dataset_principal NO se modifica: ni columnas, ni datos, ni triggers, ni permisos.
--    Los rechazos viven en private.noticias_rechazadas (esquema no expuesto por la API).
--  * La clave es la URL de la noticia, no el id: el id es un UUID generado en la carga,
--    así que un rechazo atado al id se perdería si el proceso de importación recarga la tabla.
--  * Las políticas existentes NO se tocan. Se agrega una política RESTRICTIVE, que se
--    combina con AND con todas las permisivas, sea cual sea su nombre o condición.
--  * Solo se pueden rechazar o listar noticias a través de RPC que verifican
--    private.es_administrador(). No se usa service_role.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 0. PRECONDICIONES (aborta todo si algo no coincide con lo esperado)
-- ------------------------------------------------------------------------------
do $$
declare v_rls boolean; v_force boolean;
begin
  if to_regprocedure('private.es_administrador()') is null then
    raise exception 'Falta private.es_administrador()';
  end if;
  if to_regclass('public.dataset_principal') is null then
    raise exception 'La tabla public.dataset_principal no existe';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'dataset_principal' and column_name = 'url') then
    raise exception 'dataset_principal no tiene la columna url';
  end if;

  select relrowsecurity, relforcerowsecurity into v_rls, v_force
    from pg_class where oid = 'public.dataset_principal'::regclass;
  if not v_rls then
    raise exception 'RLS esta DESACTIVADO en dataset_principal: una politica no tendria efecto. Revisar noticias_diagnostico.sql (la tabla pudo recrearse al importar).';
  end if;
  if v_force then
    raise exception 'dataset_principal tiene FORCE ROW LEVEL SECURITY: revisar manualmente antes de continuar.';
  end if;

  -- Sin una permisiva de lectura para anon, el mapa público ya no vería ninguna noticia.
  if not exists (select 1 from pg_policies
                 where schemaname = 'public' and tablename = 'dataset_principal'
                   and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL')
                   and roles && array['public', 'anon']::name[]) then
    raise exception 'No hay politica permisiva de lectura publica en dataset_principal: revisar manualmente.';
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 1. REGISTRO DE RECHAZOS (sin acceso directo para los roles de la API)
-- ------------------------------------------------------------------------------
create table if not exists private.noticias_rechazadas (
  url           text primary key,
  rechazada_por uuid,
  rechazada_en  timestamptz not null default now()
);
alter table private.noticias_rechazadas enable row level security;
revoke all on table private.noticias_rechazadas from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. RLS: las noticias rechazadas no se devuelven a ninguna consulta de la API
-- La función es SECURITY DEFINER porque anon no puede leer la tabla de rechazos.
-- USAGE sobre "private" solo permite resolver la función: no da acceso a tablas.
-- Solo se restringe SELECT: las escrituras en dataset_principal no se ven afectadas,
-- y service_role / postgres (importación) ignoran RLS.
-- ------------------------------------------------------------------------------
create or replace function private.noticia_rechazada(p_url text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.noticias_rechazadas r where r.url = p_url);
$$;

revoke all on function private.noticia_rechazada(text) from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.noticia_rechazada(text) to anon, authenticated;

drop policy if exists "Ocultar noticias rechazadas" on public.dataset_principal;
create policy "Ocultar noticias rechazadas"
  on public.dataset_principal
  as restrictive
  for select
  to anon, authenticated
  using (not private.noticia_rechazada(url));

-- ------------------------------------------------------------------------------
-- 3. FUNCIONES RPC ADMINISTRATIVAS (SECURITY DEFINER, solo 'authenticated')
-- Ninguna escribe en dataset_principal.
-- ------------------------------------------------------------------------------
create or replace function public.rechazar_noticia(p_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_n integer;
begin
  if not private.es_administrador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  select d.url into v_url from public.dataset_principal d where d.id::text = p_id;
  if not found then
    return false;
  end if;
  if v_url is null then
    raise exception 'la noticia no tiene url' using errcode = '22023';
  end if;

  insert into private.noticias_rechazadas (url, rechazada_por)
  values (v_url, auth.uid())
  on conflict (url) do nothing;

  get diagnostics v_n = row_count;
  return v_n = 1;   -- false: ya estaba rechazada
end;
$$;

-- Deshacer un rechazo hecho por error: borra solo la marca, nunca la noticia.
create or replace function public.restaurar_noticia(p_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  if not private.es_administrador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  delete from private.noticias_rechazadas r
   using public.dataset_principal d
   where d.id::text = p_id and r.url = d.url;

  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- Listado del panel: única vía para ver las rechazadas. Usa to_jsonb para no fijar
-- los tipos de las columnas de dataset_principal.
create or replace function public.noticias_admin_listado(p_filtro text, p_limite integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_res jsonb;
begin
  if not private.es_administrador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if p_filtro not in ('todas', 'visibles', 'rechazadas') then
    raise exception 'filtro invalido' using errcode = '22023';
  end if;

  with base as (
    select d as fila, r.rechazada_en
      from public.dataset_principal d
      left join private.noticias_rechazadas r on r.url = d.url
  ),
  pagina as (
    select b.fila, b.rechazada_en
      from base b
     where p_filtro = 'todas'
        or (p_filtro = 'visibles' and b.rechazada_en is null)
        or (p_filtro = 'rechazadas' and b.rechazada_en is not null)
     order by (b.fila).fecha_publicacion desc nulls last, (b.fila).id::text
     limit greatest(p_limite, 0)
  )
  select jsonb_build_object(
    'visibles', (select count(*) from base where rechazada_en is null),
    'rechazadas', (select count(*) from base where rechazada_en is not null),
    'noticias', coalesce(
      (select jsonb_agg(
                to_jsonb(p.fila) || jsonb_build_object('rechazada_en', p.rechazada_en)
                order by (p.fila).fecha_publicacion desc nulls last, (p.fila).id::text)
         from pagina p),
      '[]'::jsonb)
  ) into v_res;

  return v_res;
end;
$$;

-- Permisos EXECUTE mínimos
revoke all on function public.rechazar_noticia(text) from public, anon, authenticated;
revoke all on function public.restaurar_noticia(text) from public, anon, authenticated;
revoke all on function public.noticias_admin_listado(text, integer) from public, anon, authenticated;
grant execute on function public.rechazar_noticia(text) to authenticated;
grant execute on function public.restaurar_noticia(text) to authenticated;
grant execute on function public.noticias_admin_listado(text, integer) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. COMPROBACIÓN (si algo falla, TODO se revierte)
-- ------------------------------------------------------------------------------
do $$
declare
  r text;
  v_esperadas bigint;
  v_anon bigint;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'private.noticias_rechazadas', 'SELECT')
       or has_table_privilege(r, 'private.noticias_rechazadas', 'INSERT')
       or has_table_privilege(r, 'private.noticias_rechazadas', 'UPDATE')
       or has_table_privilege(r, 'private.noticias_rechazadas', 'DELETE') then
      raise exception 'El rol % tiene acceso directo a private.noticias_rechazadas', r;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.rechazar_noticia(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.restaurar_noticia(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.noticias_admin_listado(text,integer)', 'EXECUTE') then
    raise exception 'anon conserva EXECUTE sobre funciones administrativas';
  end if;

  -- anon debe seguir viendo exactamente las noticias no rechazadas.
  select count(*) into v_esperadas from public.dataset_principal d
   where not exists (select 1 from private.noticias_rechazadas x where x.url = d.url);
  set local role anon;
  select count(*) into v_anon from public.dataset_principal;
  reset role;
  if v_anon <> v_esperadas then
    raise exception 'anon ve % noticias, se esperaban %', v_anon, v_esperadas;
  end if;
end $$;

commit;

-- ==============================================================================
-- VERIFICACIONES POSTERIORES (ejecutar aparte, solo lectura)
-- ==============================================================================
-- A) Debe aparecer "Ocultar noticias rechazadas" como RESTRICTIVE, además de las previas:
--    select policyname, permissive, roles, cmd, qual from pg_policies
--     where schemaname = 'public' and tablename = 'dataset_principal';
--
-- B) Noticias rechazadas (al inicio, ninguna):
--    select * from private.noticias_rechazadas order by rechazada_en desc;
--
-- ==============================================================================
-- DESPUÉS DE CADA IMPORTACIÓN
-- ==============================================================================
-- Un TRUNCATE/DELETE seguido de INSERT conserva los rechazos mientras la URL no cambie.
-- Un DROP TABLE + CREATE elimina RLS y políticas de la tabla: los rechazos se conservan
-- en private.noticias_rechazadas, pero dejan de aplicarse hasta volver a ejecutar este
-- archivo. Comprobar con:
--    select relrowsecurity from pg_class where oid = 'public.dataset_principal'::regclass;
--    select count(*) from pg_policies where tablename = 'dataset_principal'
--       and policyname = 'Ocultar noticias rechazadas';   -- debe dar 1
