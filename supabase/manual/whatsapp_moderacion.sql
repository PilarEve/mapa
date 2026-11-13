-- ==============================================================================
-- REPORTES DE WHATSAPP: moderación administrativa - EJECUCIÓN MANUAL (SQL Editor)
-- NO se ejecuta automáticamente. Ejecutar en el SQL Editor de Supabase.
-- Requisitos: admin_setup.sql ya ejecutado (private.es_administrador()).
-- Es idempotente: se puede volver a ejecutar sin perder datos.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 0. PRECONDICIONES
-- ------------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('private.es_administrador()') is null then
    raise exception 'Falta private.es_administrador() (ejecutar admin_setup.sql primero)';
  end if;
  if to_regclass('public.reportes_whatsapp') is null then
    raise exception 'La tabla public.reportes_whatsapp no existe en Supabase';
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 1. COLUMNAS DE REVISIÓN Y LECTURA PÚBLICA PARA EL MAPA EN public.reportes_whatsapp
-- ------------------------------------------------------------------------------
alter table public.reportes_whatsapp
  add column if not exists revisado_por uuid,
  add column if not exists revisado_en timestamptz;

-- Actualizar la restricción CHECK de estado para admitir 'validado' (igual que public.reportes),
-- manteniendo compatibilidad con 'pendiente', 'aprobado' y 'rechazado'.
alter table public.reportes_whatsapp
  drop constraint if exists reportes_whatsapp_estado_check;

alter table public.reportes_whatsapp
  add constraint reportes_whatsapp_estado_check
  check (estado in ('pendiente', 'validado', 'aprobado', 'rechazado'));

update public.reportes_whatsapp
   set estado = 'validado'
 where estado = 'aprobado';

alter table public.reportes_whatsapp enable row level security;

-- Permite que el mapa público (/mapa) lea los reportes de WhatsApp no rechazados,
-- y que los administradores autenticados puedan leer todos.
drop policy if exists "Lectura publica restringida y admin total whatsapp" on public.reportes_whatsapp;
create policy "Lectura publica restringida y admin total whatsapp"
  on public.reportes_whatsapp
  for select
  to anon, authenticated
  using (
    coalesce(estado, 'pendiente') <> 'rechazado'
    or private.es_administrador()
  );

drop policy if exists "Admin actualiza reportes whatsapp" on public.reportes_whatsapp;
create policy "Admin actualiza reportes whatsapp"
  on public.reportes_whatsapp
  for update
  to authenticated
  using (private.es_administrador())
  with check (private.es_administrador());

-- ------------------------------------------------------------------------------
-- 2. FUNCIONES RPC ADMINISTRATIVAS (SECURITY DEFINER, solo 'authenticated')
-- Verifican siempre private.es_administrador() antes de leer o modificar.
-- ------------------------------------------------------------------------------

-- 2.1 Listado completo para el panel administrativo (/admin/whatsapp)
create or replace function public.whatsapp_admin_listado(p_estado text, p_limite integer)
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
  if p_estado not in ('todos', 'pendiente', 'validado', 'rechazado') then
    raise exception 'filtro invalido' using errcode = '22023';
  end if;

  with base as (
    select
      r.id,
      r.descripcion,
      r.latitud,
      r.longitud,
      r.imagen_url,
      r.archivo_tipo,
      coalesce(r.estado, 'pendiente') as estado,
      r.afectaciones,
      r.creado_en
    from public.reportes_whatsapp r
  ),
  pagina as (
    select *
    from base b
    where p_estado = 'todos' or b.estado = p_estado
    order by b.creado_en desc nulls last, b.id::text
    limit greatest(p_limite, 0)
  )
  select jsonb_build_object(
    'pendiente', (select count(*) from base where estado = 'pendiente'),
    'validado',  (select count(*) from base where estado = 'validado'),
    'rechazado', (select count(*) from base where estado = 'rechazado'),
    'reportes',  coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.creado_en desc nulls last, p.id::text) from pagina p),
      '[]'::jsonb
    )
  ) into v_res;

  return v_res;
end;
$$;

-- 2.2 Aprobar reporte de WhatsApp (pasa a 'validado')
create or replace function public.aprobar_reporte_whatsapp(p_id text)
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

  update public.reportes_whatsapp
     set estado = 'validado',
         revisado_por = auth.uid(),
         revisado_en = now()
   where id::text = p_id
     and coalesce(estado, 'pendiente') <> 'validado';

  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- 2.3 Rechazar reporte de WhatsApp (pasa a 'rechazado')
create or replace function public.rechazar_reporte_whatsapp(p_id text)
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

  update public.reportes_whatsapp
     set estado = 'rechazado',
         revisado_por = auth.uid(),
         revisado_en = now()
   where id::text = p_id
     and coalesce(estado, 'pendiente') <> 'rechazado';

  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- 2.4 Restaurar reporte de WhatsApp rechazado o validado (vuelve a 'pendiente')
create or replace function public.restaurar_reporte_whatsapp(p_id text)
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

  update public.reportes_whatsapp
     set estado = 'pendiente',
         revisado_por = null,
         revisado_en = null
   where id::text = p_id
     and coalesce(estado, 'pendiente') <> 'pendiente';

  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. PERMISOS EXECUTE MÍNIMOS
-- ------------------------------------------------------------------------------
revoke all on function public.whatsapp_admin_listado(text, integer) from public, anon, authenticated;
revoke all on function public.aprobar_reporte_whatsapp(text) from public, anon, authenticated;
revoke all on function public.rechazar_reporte_whatsapp(text) from public, anon, authenticated;
revoke all on function public.restaurar_reporte_whatsapp(text) from public, anon, authenticated;

grant execute on function public.whatsapp_admin_listado(text, integer) to authenticated;
grant execute on function public.aprobar_reporte_whatsapp(text) to authenticated;
grant execute on function public.rechazar_reporte_whatsapp(text) to authenticated;
grant execute on function public.restaurar_reporte_whatsapp(text) to authenticated;

notify pgrst, 'reload schema';

commit;

