-- ==============================================================================
-- ETAPA 3: PERFIL DE ADMINISTRADOR - EJECUCIÓN MANUAL (SQL Editor de Supabase)
-- NO se ejecuta automáticamente. Revisar antes de correr.
-- ==============================================================================
-- SUPUESTO: private.es_administrador() no recibe argumentos y usa auth.uid()
-- internamente. Si su firma es distinta (p. ej. recibe un uuid), ajustar la
-- llamada en el wrapper. Verificar con:
--   select pg_get_functiondef('private.es_administrador'::regproc);
--
-- Por qué un wrapper: el esquema "private" NO está expuesto por la API de
-- Supabase (y no debe estarlo). La app necesita una función en "public" que
-- delegue en private.es_administrador().

create or replace function public.es_administrador_actual()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.es_administrador();
$$;

revoke all on function public.es_administrador_actual() from public, anon;
grant execute on function public.es_administrador_actual() to authenticated;

-- IMPORTANTE: "security invoker" requiere que el rol "authenticated" tenga
-- USAGE sobre el esquema private y EXECUTE sobre private.es_administrador().
-- Si private.es_administrador() es SECURITY DEFINER, basta con:
--   grant usage on schema private to authenticated;
--   grant execute on function private.es_administrador() to authenticated;
-- (No dar acceso SELECT a private.administradores.)
-- Alternativa: cambiar el wrapper a "security definer" (mantener set search_path = '').

-- ------------------------------------------------------------------------------
-- VINCULAR TU USUARIO COMO ADMINISTRADOR
-- 1. Dashboard > Authentication > Users > Add user > Create new user
--    (tu correo + una contraseña fuerte propia; marcar "Auto Confirm User").
--    Desactivar registros públicos: Authentication > Providers > Email >
--    desmarcar "Allow new users to sign up" (evita que ciudadanos se registren).
-- 2. Copiar el UUID del usuario creado.
-- 3. Revisar columnas de la tabla:
--      select column_name from information_schema.columns
--      where table_schema = 'private' and table_name = 'administradores';
-- 4. Insertar (ajustar nombre de columna si no es user_id):
--      insert into private.administradores (user_id) values ('<UUID-DE-TU-USUARIO>');
-- 5. Verificar:  select private.es_administrador();  (desde sesión del usuario)
-- ------------------------------------------------------------------------------

