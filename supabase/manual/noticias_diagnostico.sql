-- ==============================================================================
-- NOTICIAS HISTÓRICAS: diagnóstico de dataset_principal - SOLO LECTURA
-- Ejecutar ANTES de noticias_moderacion.sql, cada bloque por separado
-- (el SQL Editor solo muestra el resultado de la última consulta).
-- ==============================================================================

-- 1. Columnas y tipos
select column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'dataset_principal'
 order by ordinal_position;

-- 2. Clave primaria y restricciones únicas
select conname, contype, pg_get_constraintdef(oid) as definicion
  from pg_constraint
 where conrelid = 'public.dataset_principal'::regclass;

-- 3. RLS y dueño de la tabla (rls_activo debe ser true y rls_forzado false)
select relrowsecurity as rls_activo, relforcerowsecurity as rls_forzado,
       pg_get_userbyid(relowner) as dueno
  from pg_class
 where oid = 'public.dataset_principal'::regclass;

-- 4. Políticas reales (pueden diferir de las migraciones del repositorio)
select policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public' and tablename = 'dataset_principal';

-- 5. Permisos de los roles de la API
select grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'dataset_principal'
 group by grantee;

-- 6. Triggers
select tgname, pg_get_triggerdef(oid) as definicion
  from pg_trigger
 where tgrelid = 'public.dataset_principal'::regclass and not tgisinternal;

-- 7. Vistas que dependen de la tabla. Una vista sin security_invoker saltea RLS y
--    seguiría exponiendo las noticias rechazadas: avisar si aparece alguna.
select distinct v.oid::regclass as vista, v.reloptions
  from pg_depend d
  join pg_rewrite w on w.oid = d.objid
  join pg_class v on v.oid = w.ev_class
 where d.refobjid = 'public.dataset_principal'::regclass
   and v.oid <> 'public.dataset_principal'::regclass;

-- 8. Funciones que mencionan la tabla (importación u otras vías de lectura)
select n.nspname as esquema, p.proname as funcion, p.prosecdef as security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where p.prosrc ilike '%dataset_principal%';

-- 9. Calidad de la clave de moderación (url)
select count(*) as filas,
       count(url) as con_url,
       count(distinct url) as url_distintas,
       count(distinct id) as id_distintos,
       count(distinct creado_en) as cargas_distintas
  from public.dataset_principal;

-- 10. Funciones de administrador
select pg_get_functiondef('private.es_administrador'::regproc);
