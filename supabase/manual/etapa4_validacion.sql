-- ==============================================================================
-- ETAPA 4 (DEFINITIVO): VALIDACIÓN MANUAL DE REPORTES - EJECUCIÓN MANUAL
-- NO se ejecuta automáticamente. Ejecutar en el SQL Editor, de una sola vez.
-- Requisitos previos: Etapa 1 (políticas de reportes y buckets) y admin_setup.sql.
--
-- Decisiones:
--  * Un ÚNICO mecanismo de moderación: funciones RPC. Se ELIMINA la política UPDATE
--    existente ("Actualizacion exclusiva para administradores") y se revoca UPDATE
--    directo sobre reportes. Así no hay dos caminos de escritura.
--  * No se tocan las políticas SELECT/INSERT de Etapa 1 (ya cumplen lo requerido).
--  * El bucket 'reportes-privados' NO lo crea ni lo modifica este script: se crea a mano
--    (PASO 0 más abajo) y el script solo verifica que sea privado y compatible.
--  * Sin DELETE general para administradores: el retiro de una imagen pública lo autoriza
--    una función (private.puede_retirar_imagen_publica) atada a un reporte rechazado con
--    copia privada comprobada. Se revoca también el UPDATE por columna (estado) de Etapa 1.
-- ==============================================================================

-- ==============================================================================
-- PASO 0 (MANUAL, ANTES de ejecutar este script): crear el bucket 'reportes-privados'
--   1. Supabase Dashboard > Storage > New bucket.
--   2. Name: reportes-privados      (exactamente así)
--   3. Public bucket: DESACTIVADO   (debe quedar privado)
--   4. Activar "Restrict file size" y poner 50 MB (52428800 bytes)
--      (o dejarlo sin límite propio: entonces rige el límite global del proyecto).
--   5. Activar "Restrict MIME types" con:
--        image/jpeg, image/png, image/webp, image/heic, image/heif, image/avif
--      (o dejarlo sin restricción).
--   6. Create. No crear políticas desde el Dashboard: este script las crea.
--   7. Verificar el límite global: Storage > Settings > "Upload file size limit" >= 50 MB
--      (el efectivo es el menor entre el global y el del bucket).
--   8. Comparar con el bucket público: select id, public, file_size_limit, allowed_mime_types
--        from storage.buckets where id in ('reportes','reportes-privados');
-- Este script solo VERIFICA el bucket y aborta con un mensaje claro si no cumple.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 0. PRECONDICIONES (aborta todo si algo no coincide con lo esperado)
-- ------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reportes'
                 and policyname = 'Lectura publica restringida y admin total' and cmd = 'SELECT') then
    raise exception 'Falta la politica SELECT "Lectura publica restringida y admin total" en reportes';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reportes'
                 and policyname = 'Insercion ciudadana forzada a pendiente' and cmd = 'INSERT') then
    raise exception 'Falta la politica INSERT "Insercion ciudadana forzada a pendiente" en reportes';
  end if;
  if not exists (select 1 from storage.buckets where id = 'reportes-privados') then
    raise exception 'El bucket reportes-privados NO existe. Crealo primero desde Storage (ver PASO 0 al inicio de este archivo).';
  end if;
  if exists (select 1 from storage.buckets where id = 'reportes-privados' and public) then
    raise exception 'El bucket reportes-privados es PUBLICO. Debe ser privado (Storage > bucket > Edit > desactivar Public).';
  end if;
  -- Capacidad: debe admitir al menos 50 MB (o no tener limite propio)
  if exists (select 1 from storage.buckets where id = 'reportes-privados'
             and file_size_limit is not null and file_size_limit < 52428800) then
    raise exception 'reportes-privados limita el tamano por debajo de 50 MB. Editar el bucket (PASO 0).';
  end if;
  -- Formatos: sin restriccion de MIME, o incluyendo los 6 formatos del bucket publico
  if exists (select 1 from storage.buckets where id = 'reportes-privados'
             and allowed_mime_types is not null
             and not (allowed_mime_types @> array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/avif'])) then
    raise exception 'reportes-privados no admite los 6 formatos requeridos. Editar el bucket (PASO 0).';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'es_administrador_actual') then
    raise exception 'Falta public.es_administrador_actual() (admin_setup.sql)';
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 1. COLUMNAS DE REVISIÓN (no alteran datos existentes)
-- ------------------------------------------------------------------------------
alter table public.reportes
  add column if not exists imagen_privada_path text,
  add column if not exists imagen_sha256 text,
  add column if not exists imagen_publica_retirada boolean not null default false,
  add column if not exists revisado_por uuid,
  add column if not exists revisado_en timestamptz;

-- ------------------------------------------------------------------------------
-- 2. RLS DE reportes: un único mecanismo de moderación (RPC)
-- ------------------------------------------------------------------------------
-- 2.1 Quitar políticas duplicadas/contradictorias de borradores anteriores.
--     (La lectura pública con USING(true) expondría los rechazados: debe desaparecer.)
drop policy if exists "Permitir lectura publica de reportes" on public.reportes;
drop policy if exists "Administradores leen todos los reportes" on public.reportes;
drop policy if exists "Permitir insercion ciudadana de reportes" on public.reportes;

-- 2.2 Eliminar CUALQUIER política UPDATE de reportes (incluida la de Etapa 1).
do $$
declare pol record;
begin
  for pol in select policyname, cmd from pg_policies
             where schemaname = 'public' and tablename = 'reportes'
  loop
    if pol.cmd = 'UPDATE' then
      execute format('drop policy %I on public.reportes', pol.policyname);
      raise notice 'Eliminada politica UPDATE: %', pol.policyname;
    elsif pol.cmd in ('ALL', 'DELETE') then
      raise warning 'Politica % (%) permite escritura/borrado: revisar manualmente', pol.policyname, pol.cmd;
    end if;
  end loop;
end $$;

-- 2.3 Revocar UPDATE/DELETE directo a los roles de la API.
--     El GRANT UPDATE (estado) de Etapa 1 es un permiso a nivel de COLUMNA: revocar el
--     permiso de tabla NO lo elimina. Se revoca columna por columna (incluye "estado").
revoke update, delete, truncate on public.reportes from public, anon, authenticated;
do $$
declare col record;
begin
  for col in select attname from pg_attribute
             where attrelid = 'public.reportes'::regclass and attnum > 0 and not attisdropped
  loop
    execute format('revoke update (%I) on public.reportes from public, anon, authenticated', col.attname);
  end loop;
end $$;

-- ------------------------------------------------------------------------------
-- 3. FUNCIONES RPC (SECURITY DEFINER, search_path vacío, solo 'authenticated')
-- Todas: verifican private.es_administrador(), solo actúan sobre reportes
-- 'pendiente' (o la fase de retiro de uno 'rechazado'), y nunca tocan fotografía
-- (imagen_url), coordenadas, descripción ni afectaciones. id comparado como texto.
-- ------------------------------------------------------------------------------
create or replace function public.aprobar_reporte(p_id text)
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
     set estado = 'validado', revisado_por = auth.uid(), revisado_en = now()
   where id::text = p_id and estado = 'pendiente';

  get diagnostics v_n = row_count;
  return v_n = 1;   -- false: no existe o ya fue revisado (modificación concurrente)
end;
$$;

-- El rechazo exige que la copia privada corresponda a ESTE reporte:
--  a) ruta privada determinista:  rechazados/<id>/<nombre del archivo público>
--  b) el archivo público sale de imagen_url del propio reporte (no de un parámetro)
--  c) existen ambos objetos y coinciden en tamaño y tipo MIME
--  d) se registra el SHA-256 calculado por el servidor (evidencia de integridad)
create or replace function public.rechazar_reporte(p_id text, p_ruta_privada text, p_sha256 text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_pub text;
  v_expected text;
  v_pub_obj record;
  v_priv_obj record;
  v_n integer;
begin
  if not private.es_administrador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256 invalido' using errcode = '22023';
  end if;

  select imagen_url into v_url
    from public.reportes
   where id::text = p_id and estado = 'pendiente'
   for update;
  if not found then
    return false;   -- no existe o ya revisado
  end if;

  v_pub := substring(v_url from '/object/public/reportes/(imagenes/[^?]+)$');
  if v_pub is null or v_pub like '%..%' then
    raise exception 'imagen_url no corresponde al bucket publico' using errcode = '22023';
  end if;

  v_expected := 'rechazados/' || p_id || '/' || substring(v_pub from 'imagenes/(.+)$');
  if p_ruta_privada is distinct from v_expected then
    raise exception 'ruta privada no corresponde al reporte' using errcode = '22023';
  end if;

  select metadata into v_pub_obj from storage.objects where bucket_id = 'reportes' and name = v_pub;
  select metadata into v_priv_obj from storage.objects where bucket_id = 'reportes-privados' and name = v_expected;
  if v_pub_obj is null or v_priv_obj is null then
    raise exception 'falta la copia publica o privada' using errcode = '22023';
  end if;
  if (v_pub_obj.metadata->>'size') is distinct from (v_priv_obj.metadata->>'size')
     or (v_pub_obj.metadata->>'mimetype') is distinct from (v_priv_obj.metadata->>'mimetype') then
    raise exception 'la copia privada no coincide con la publica' using errcode = '22023';
  end if;

  update public.reportes
     set estado = 'rechazado',
         imagen_privada_path = v_expected,
         imagen_sha256 = p_sha256,
         revisado_por = auth.uid(),
         revisado_en = now()
   where id::text = p_id and estado = 'pendiente';

  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- Marca la copia pública como retirada SOLO si el objeto público ya no existe.
create or replace function public.marcar_imagen_publica_retirada(p_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_pub text;
  v_n integer;
begin
  if not private.es_administrador() then
    raise exception 'no autorizado' using errcode = '42501';
  end if;

  select imagen_url into v_url
    from public.reportes
   where id::text = p_id and estado = 'rechazado'
     and imagen_privada_path is not null and imagen_publica_retirada = false
   for update;
  if not found then
    return false;
  end if;

  v_pub := substring(v_url from '/object/public/reportes/(imagenes/[^?]+)$');
  if v_pub is null or exists (select 1 from storage.objects where bucket_id = 'reportes' and name = v_pub) then
    return false;   -- la copia pública todavía existe
  end if;

  update public.reportes set imagen_publica_retirada = true
   where id::text = p_id and estado = 'rechazado' and imagen_publica_retirada = false;
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- Permisos EXECUTE mínimos (Supabase concede por defecto a anon/authenticated: se revoca explícito)
drop function if exists public.rechazar_reporte(text, text);
revoke all on function public.aprobar_reporte(text) from public, anon, authenticated;
revoke all on function public.rechazar_reporte(text, text, text) from public, anon, authenticated;
revoke all on function public.marcar_imagen_publica_retirada(text) from public, anon, authenticated;
grant execute on function public.aprobar_reporte(text) to authenticated;
grant execute on function public.rechazar_reporte(text, text, text) to authenticated;
grant execute on function public.marcar_imagen_publica_retirada(text) to authenticated;

-- ------------------------------------------------------------------------------
-- 4. STORAGE: políticas administrativas mínimas (se conservan las de Etapa 1)
-- ------------------------------------------------------------------------------
drop policy if exists "Admin lee reportes-privados" on storage.objects;
drop policy if exists "Admin sube a reportes-privados" on storage.objects;
drop policy if exists "Admin retira imagenes publicas de reportes" on storage.objects;
drop policy if exists "Admin retira imagen publica de reporte rechazado" on storage.objects;

-- 4.1 Leer el bucket privado: solo administradores.
create policy "Admin lee reportes-privados"
  on storage.objects for select to authenticated
  using (bucket_id = 'reportes-privados' and private.es_administrador());

-- 4.2 Subir al bucket privado: solo administradores y SOLO en la carpeta de un
--     reporte que sigue pendiente: rechazados/<id-del-reporte>/...
--     Sin UPDATE ni DELETE: el original privado no se puede sobrescribir ni borrar.
create policy "Admin sube a reportes-privados"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'reportes-privados'
    and private.es_administrador()
    and (storage.foldername(name))[1] = 'rechazados'
    and exists (
      select 1 from public.reportes r
       where r.id::text = (storage.foldername(name))[2] and r.estado = 'pendiente'
    )
  );

-- 4.3 Retirar una imagen pública: NO hay DELETE general.
--     La política NO consulta storage.objects directamente (evita recursión RLS sobre
--     la misma tabla): delega en una función SECURITY DEFINER del esquema no expuesto
--     "private", que lee storage.objects y reportes sin pasar por RLS.
--     Autoriza el borrado solo si: es administrador; existe un reporte RECHAZADO cuya
--     imagen_url apunta exactamente a ese objeto; aún no fue retirada; tiene hash y
--     ruta privada registrados; y la copia privada existe con el mismo tamaño y MIME.
--     (El hash byte a byte lo vuelve a comprobar el servidor antes de llamar a remove().)
grant usage on schema private to authenticated;   -- solo permite resolver la función; no da acceso a tablas

create or replace function private.puede_retirar_imagen_publica(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  if not private.es_administrador() then
    return false;
  end if;

  select exists (
    select 1
      from public.reportes r
      join storage.objects pub  on pub.bucket_id = 'reportes' and pub.name = p_name
      join storage.objects priv on priv.bucket_id = 'reportes-privados' and priv.name = r.imagen_privada_path
     where r.estado = 'rechazado'
       and r.imagen_publica_retirada = false
       and r.imagen_sha256 is not null
       and r.imagen_privada_path is not null
       and p_name like 'imagenes/%'
       and substring(r.imagen_url from '/object/public/reportes/(imagenes/[^?]+)$') = p_name
       and r.imagen_privada_path = 'rechazados/' || r.id::text || '/' || substring(p_name from 'imagenes/(.+)$')
       and (pub.metadata->>'size') = (priv.metadata->>'size')
       and (pub.metadata->>'mimetype') = (priv.metadata->>'mimetype')
  ) into v_ok;

  return coalesce(v_ok, false);
end;
$$;

revoke all on function private.puede_retirar_imagen_publica(text) from public, anon, authenticated;
grant execute on function private.puede_retirar_imagen_publica(text) to authenticated;

create policy "Admin retira imagen publica de reporte rechazado"
  on storage.objects for delete to authenticated
  using (bucket_id = 'reportes' and private.puede_retirar_imagen_publica(name));

-- ------------------------------------------------------------------------------
-- 5. COMPROBACIÓN DE PRIVILEGIOS EFECTIVOS (si algo falla, TODO se revierte)
-- ------------------------------------------------------------------------------
do $$
declare col record; r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'public.reportes', 'DELETE')
       or has_table_privilege(r, 'public.reportes', 'TRUNCATE') then
      raise exception 'El rol % aun puede borrar/truncar reportes', r;
    end if;
    for col in select attname from pg_attribute
               where attrelid = 'public.reportes'::regclass and attnum > 0 and not attisdropped
    loop
      if has_column_privilege(r, 'public.reportes', col.attname, 'UPDATE') then
        raise exception 'El rol % aun tiene UPDATE sobre la columna %', r, col.attname;
      end if;
    end loop;
    if has_function_privilege(r, 'public.aprobar_reporte(text)', 'EXECUTE') and r = 'anon' then
      raise exception 'anon puede ejecutar aprobar_reporte';
    end if;
  end loop;
  if has_function_privilege('anon', 'public.aprobar_reporte(text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rechazar_reporte(text,text,text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.marcar_imagen_publica_retirada(text)', 'EXECUTE')
     or has_function_privilege('anon', 'private.puede_retirar_imagen_publica(text)', 'EXECUTE') then
    raise exception 'anon conserva EXECUTE sobre funciones administrativas';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reportes' and cmd = 'UPDATE') then
    raise exception 'Queda una politica UPDATE en reportes';
  end if;
end $$;

commit;

-- ==============================================================================
-- VERIFICACIONES POSTERIORES (ejecutar aparte, solo lectura)
-- ==============================================================================
-- A) Bucket privado: debe dar public=false, 52428800 y los 6 MIME.
--    select id, public, file_size_limit, allowed_mime_types from storage.buckets
--     where id in ('reportes', 'reportes-privados');
--    NOTA: el límite efectivo es el MENOR entre el del bucket y el global del proyecto
--    (Dashboard > Storage > Settings > "Upload file size limit"); debe ser >= 50 MB.
--
-- B) Políticas de reportes: SELECT (Etapa 1), INSERT (Etapa 1) y NINGUNA UPDATE/DELETE.
--    select policyname, cmd from pg_policies
--     where schemaname = 'public' and tablename = 'reportes' order by cmd;
--
-- C) Políticas de storage.objects:
--    select policyname, cmd from pg_policies
--     where schemaname = 'storage' and tablename = 'objects' order by policyname;
--
-- D) Permisos EXECUTE (anon no debe aparecer):
--    select routine_name, grantee from information_schema.routine_privileges
--     where routine_schema = 'public'
--       and routine_name in ('aprobar_reporte','rechazar_reporte','marcar_imagen_publica_retirada')
--     order by 1, 2;
--
-- ACTIVAR EN LA APP (sin NEXT_PUBLIC_, solo servidor; reiniciar tras cambiar):
--   ADMIN_APROBACION_HABILITADA=true   -> habilita "Aprobar"
--   ADMIN_RECHAZO_HABILITADO=true      -> habilita "Rechazar" (activar después de probar Aprobar)
-- CACHÉ: la foto pública puede seguir visible hasta ~1 h tras el borrado (cacheControl 3600).
