-- ==============================================================================
-- AJUSTE MÍNIMO DE PERMISOS Y POLÍTICAS PARA public.reportes_manual Y STORAGE
-- 1. Otorga privilegios base de tabla a 'authenticated' y lectura a 'anon'
--    (la autorización real sigue gobernada estrictamente por RLS + private.es_administrador()).
-- 2. Permite que el administrador inserte con estado 'validado' o 'pendiente'.
-- 3. Permite al administrador retirar/reemplazar imágenes en imagenes/manuales/.
-- Es idempotente: se puede ejecutar de forma segura en el SQL Editor de Supabase.
-- ==============================================================================

begin;

-- 0. Asegurar que RLS esté activo y otorgar los permisos de tabla requeridos por PostgREST
alter table public.reportes_manual enable row level security;

revoke all on table public.reportes_manual from public, anon, authenticated;
grant select on table public.reportes_manual to anon;
grant select, insert, update, delete on table public.reportes_manual to authenticated;

-- 1. Permitir que el administrador inserte con estado 'validado' o 'pendiente'
drop policy if exists "Admin crea reportes manuales" on public.reportes_manual;
create policy "Admin crea reportes manuales"
  on public.reportes_manual
  for insert
  to authenticated
  with check (
    private.es_administrador()
    and creado_por = auth.uid()
    and estado in ('pendiente', 'validado')
  );

-- 2. Permitir al administrador borrar archivos propios del módulo manual
--    (al eliminar un reporte manual o reemplazar su fotografía al editarlo),
--    aislado estrictamente a la subcarpeta 'imagenes/manuales/' del bucket 'reportes'.
drop policy if exists "Admin elimina imagenes de reportes manuales" on storage.objects;
create policy "Admin elimina imagenes de reportes manuales"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'reportes'
    and private.es_administrador()
    and name like 'imagenes/manuales/%'
  );

notify pgrst, 'reload schema';

commit;
