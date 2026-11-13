-- ==============================================================================
-- RESTAURACIÓN DE REPORTES RECHAZADOS - EJECUCIÓN MANUAL (SQL Editor)
-- NO se ejecuta automáticamente. Ejecutar en el SQL Editor, de una sola vez.
-- Requisitos: admin_setup.sql y etapa4_validacion.sql ya ejecutados.
-- Es idempotente. No modifica ningún reporte existente ni políticas existentes.
--
-- Flujo (lo ejecuta app/admin/review-actions.ts con la sesión del administrador):
--  1. preparar_restauracion_reporte: deja imagen_publica_retirada = false ANTES de subir.
--     Si algo falla después, el panel ofrece "Reintentar retiro" y la política de borrado
--     existente puede retirar la copia pública. Una foto rechazada nunca queda expuesta
--     sin que el panel lo indique.
--  2. El servidor sube los bytes originales a 'reportes' y verifica su SHA-256.
--  3. restaurar_reporte: pasa rechazado -> pendiente solo si ambas copias existen y
--     coinciden, y registra la auditoría en la misma transacción.
--
-- La auditoría vive en "private": anon puede leer todas las columnas de public.reportes,
-- así que el administrador que restauró no se guarda en esa tabla.
-- La subida usa la política INSERT existente de 'reportes' (carpeta imagenes/).
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 0. PRECONDICIONES (aborta todo si algo no coincide con lo esperado)
-- ------------------------------------------------------------------------------
do $$
declare col text;
begin
  if to_regprocedure('private.es_administrador()') is null then
    raise exception 'Falta private.es_administrador()';
  end if;
  if to_regprocedure('private.puede_retirar_imagen_publica(text)') is null
     or to_regprocedure('public.marcar_imagen_publica_retirada(text)') is null
     or to_regprocedure('public.rechazar_reporte(text,text,text)') is null then
    raise exception 'Faltan funciones de etapa4_validacion.sql';
  end if;
  foreach col in array array['imagen_url', 'imagen_privada_path', 'imagen_sha256',
                             'imagen_publica_retirada', 'revisado_por', 'revisado_en'] loop
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'reportes' and column_name = col) then
      raise exception 'public.reportes no tiene la columna %', col;
    end if;
  end loop;
  if not exists (select 1 from storage.buckets where id = 'reportes-privados' and not public) then
    raise exception 'El bucket reportes-privados no existe o es publico';
  end if;
  -- El administrador sube con su sesión: necesita una política INSERT sobre el bucket público.
  if not exists (select 1 from pg_policies
                 where schemaname = 'storage' and tablename = 'objects' and cmd in ('INSERT', 'ALL')
                   and roles && array['public', 'authenticated']::name[]
                   and coalesce(with_check, qual) like '%''reportes''%') then
    raise exception 'authenticated no tiene politica INSERT sobre el bucket reportes';
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 1. AUDITORÍA (sin acceso directo para los roles de la API)
-- ------------------------------------------------------------------------------
create table if not exists private.reportes_restauraciones (
  id                  bigint generated always as identity primary key,
  reporte_id          text not null,
  restaurado_por      uuid not null,
  restaurado_en       timestamptz not null default now(),
  rechazado_por       uuid,
  rechazado_en        timestamptz,
  imagen_privada_path text not null,
  imagen_sha256       text not null
);
create index if not exists reportes_restauraciones_reporte_idx
  on private.reportes_restauraciones (reporte_id);
alter table private.reportes_restauraciones enable row level security;
revoke all on table private.reportes_restauraciones from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. FUNCIONES RPC (SECURITY DEFINER, search_path vacío, solo 'authenticated')
-- ------------------------------------------------------------------------------

-- Registra la intención antes de subir. Solo actúa sobre rechazados con copia privada.
create or replace function public.preparar_restauracion_reporte(p_id text)
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

  update public.reportes
     set imagen_publica_retirada = false
   where id::text = p_id
     and estado = 'rechazado'
     and imagen_privada_path is not null
     and imagen_sha256 is not null;

  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- Transición rechazado -> pendiente. La fila queda bloqueada hasta el final: de dos
-- restauraciones simultáneas, solo una la realiza; la otra recibe false.
-- No toca fotografía, coordenadas, descripción, afectaciones ni la copia privada.
-- imagen_publica_retirada queda en false porque hay copia pública: un nuevo rechazo
-- necesita ese valor para poder retirarla.
create or replace function public.restaurar_reporte(p_id text, p_sha256 text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_priv text;
  v_sha text;
  v_rev_por uuid;
  v_rev_en timestamptz;
  v_pub text;
  v_pub_meta jsonb;
  v_priv_meta jsonb;
begin
  if not private.es_administrador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256 invalido' using errcode = '22023';
  end if;

  select imagen_url, imagen_privada_path, imagen_sha256, revisado_por, revisado_en
    into v_url, v_priv, v_sha, v_rev_por, v_rev_en
    from public.reportes
   where id::text = p_id and estado = 'rechazado'
   for update;
  if not found then
    return false;   -- no existe, o ya fue restaurado por otro administrador
  end if;

  if v_priv is null or v_sha is null then
    raise exception 'el reporte no tiene copia privada registrada' using errcode = '22023';
  end if;
  if p_sha256 is distinct from v_sha then
    raise exception 'el hash no coincide con el registrado' using errcode = '22023';
  end if;

  v_pub := substring(v_url from '/object/public/reportes/(imagenes/[^?]+)$');
  if v_pub is null or v_pub like '%..%' then
    raise exception 'imagen_url no corresponde al bucket publico' using errcode = '22023';
  end if;
  if v_priv is distinct from 'rechazados/' || p_id || '/' || substring(v_pub from 'imagenes/(.+)$') then
    raise exception 'ruta privada no corresponde al reporte' using errcode = '22023';
  end if;

  select metadata into v_pub_meta from storage.objects where bucket_id = 'reportes' and name = v_pub;
  select metadata into v_priv_meta from storage.objects where bucket_id = 'reportes-privados' and name = v_priv;
  if v_pub_meta is null or v_priv_meta is null then
    raise exception 'falta la copia publica o privada' using errcode = '22023';
  end if;
  if (v_pub_meta->>'size') is distinct from (v_priv_meta->>'size')
     or (v_pub_meta->>'mimetype') is distinct from (v_priv_meta->>'mimetype') then
    raise exception 'la copia publica no coincide con la privada' using errcode = '22023';
  end if;

  update public.reportes
     set estado = 'pendiente',
         imagen_publica_retirada = false,
         revisado_por = null,
         revisado_en = null
   where id::text = p_id and estado = 'rechazado';

  insert into private.reportes_restauraciones
    (reporte_id, restaurado_por, rechazado_por, rechazado_en, imagen_privada_path, imagen_sha256)
  values
    (p_id, auth.uid(), v_rev_por, v_rev_en, v_priv, v_sha);

  return true;
end;
$$;

-- Permisos EXECUTE mínimos
revoke all on function public.preparar_restauracion_reporte(text) from public, anon, authenticated;
revoke all on function public.restaurar_reporte(text, text) from public, anon, authenticated;
grant execute on function public.preparar_restauracion_reporte(text) to authenticated;
grant execute on function public.restaurar_reporte(text, text) to authenticated;

-- Restauración directa a 'pendiente' cuando el reporte está 'validado'
-- (o 'rechazado' sin copia privada retirada, por lo que la foto pública sigue intacta).
create or replace function public.restaurar_reporte_pendiente(p_id text)
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

  update public.reportes
     set estado = 'pendiente',
         revisado_por = null,
         revisado_en = null
   where id::text = p_id
     and (estado = 'validado' or (estado = 'rechazado' and imagen_privada_path is null));

  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

revoke all on function public.restaurar_reporte_pendiente(text) from public, anon, authenticated;
grant execute on function public.restaurar_reporte_pendiente(text) to authenticated;

-- ------------------------------------------------------------------------------
-- 3. COMPROBACIÓN (si algo falla, TODO se revierte)
-- ------------------------------------------------------------------------------
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'private.reportes_restauraciones', 'SELECT')
       or has_table_privilege(r, 'private.reportes_restauraciones', 'INSERT')
       or has_table_privilege(r, 'private.reportes_restauraciones', 'UPDATE')
       or has_table_privilege(r, 'private.reportes_restauraciones', 'DELETE') then
      raise exception 'El rol % tiene acceso directo a la auditoria', r;
    end if;
  end loop;
  if has_function_privilege('anon', 'public.preparar_restauracion_reporte(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.restaurar_reporte(text,text)', 'EXECUTE') then
    raise exception 'anon conserva EXECUTE sobre funciones de restauracion';
  end if;
end $$;

commit;

-- ==============================================================================
-- CONSULTAS POSTERIORES (ejecutar aparte, solo lectura)
-- ==============================================================================
-- A) Auditoría: quién restauró qué y cuándo.
--    select * from private.reportes_restauraciones order by restaurado_en desc;
--
-- B) Lectura pública de reportes: su condición debe admitir estado = 'pendiente',
--    o el reporte restaurado no aparecerá en el mapa público.
--    select policyname, roles, cmd, qual from pg_policies
--     where schemaname = 'public' and tablename = 'reportes' and cmd = 'SELECT';
--
-- C) Rechazados que se pueden restaurar (el hash lo comprueba el servidor):
--    select r.id, r.imagen_publica_retirada, (o.name is not null) as copia_privada_existe
--      from public.reportes r
--      left join storage.objects o
--        on o.bucket_id = 'reportes-privados' and o.name = r.imagen_privada_path
--     where r.estado = 'rechazado';
