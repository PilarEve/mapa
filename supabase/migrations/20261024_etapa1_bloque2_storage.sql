-- ==============================================================================
-- ETAPA 1 - BLOQUE 2: SEGURIDAD DE SUPABASE STORAGE - PROYECTO VENUS
-- ==============================================================================
-- Este script configura la infraestructura de almacenamiento de fotografías:
-- 1. Bucket público 'reportes' para fotografías de reportes ciudadanos (pendientes y validados).
-- 2. Bucket privado 'reportes-privados' para fotografías de reportes rechazados
--    (conservación segura de evidencias para moderación administrativa en Etapa 4).
-- 3. Políticas RLS en storage.objects para proteger la integridad de los archivos.
--
-- CONFIGURACIÓN DE SEGURIDAD:
-- - Límite de tamaño: 50 MB (52428800 bytes, límite técnico efectivo de Supabase).
-- - Tipos MIME permitidos: JPEG, PNG, WEBP, HEIC, HEIF y AVIF.
-- - Lectura pública: Abierta para el bucket 'reportes' (mantiene legibles las fotos existentes).
-- - Subida ciudadana: Restringida exclusivamente al directorio 'imagenes/' en 'reportes'.
-- - Sin permisos públicos de UPDATE ni DELETE: Previene sobrescrituras y eliminaciones anónimas.
-- - Bucket privado 'reportes-privados': Queda aislado sin acceso público ni políticas de cliente
--   (las políticas administrativas FOR ALL se configurarán en la Etapa 4).
--
-- INSTRUCCIONES:
-- 1. Iniciar sesión en el panel de Supabase (https://supabase.com/dashboard).
-- 2. Ir a SQL Editor -> New Query.
-- 3. Pegar y ejecutar este script completo.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. BUCKET PÚBLICO: 'reportes' (fotografías ciudadanas)
-- ------------------------------------------------------------------------------
-- Asegura que el bucket 'reportes' sea público, admita hasta 50 MB y acepte
-- los formatos fotográficos compatibles sin compresión forzada.
UPDATE storage.buckets
SET public = true,
    file_size_limit = 52428800, -- 50 MB en bytes
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/avif'
    ]
WHERE id = 'reportes';


-- ------------------------------------------------------------------------------
-- 2. BUCKET PRIVADO: 'reportes-privados' (preparación para moderación)
-- ------------------------------------------------------------------------------
-- Se crea como bucket PRIVADO (public = false).
-- Al no tener políticas de acceso para los roles anon ni authenticated, ningún
-- usuario público puede listar, descargar ni subir archivos en este bucket.
-- Las políticas administrativas de moderación se vincularán en la Etapa 4.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reportes-privados',
  'reportes-privados',
  false,
  52428800, -- 50 MB en bytes
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/avif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/avif'
  ];


-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS ROW LEVEL SECURITY (RLS) EN storage.objects
-- ------------------------------------------------------------------------------
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3.1 ELIMINACIÓN DE POLÍTICAS ANTERIORES
-- Reemplaza las políticas antiguas existentes en Supabase identificadas por su nombre exacto:
DROP POLICY IF EXISTS "Permitir subir imagenes de reportes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir ver imagenes de reportes" ON storage.objects;

-- Limpieza preventiva de nombres alternativos utilizados en borradores previos:
DROP POLICY IF EXISTS "Permitir subida de imagenes en reportes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida ciudadana en reportes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura publica de imagenes reportes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura publica bucket reportes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir acceso administrativo reportes-privados" ON storage.objects;

-- 3.2 LECTURA PÚBLICA EN BUCKET 'reportes'
-- Permite lectura pública (anon y authenticated) de cualquier objeto en 'reportes',
-- asegurando que todas las fotografías existentes sigan siendo visibles en el mapa.
CREATE POLICY "Permitir ver imagenes de reportes"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'reportes');

-- 3.3 SUBIDA CIUDADANA RESTRINGIDA A 'imagenes/'
-- Permite a ciudadanos (anon y authenticated) subir evidencias fotográficas únicamente
-- dentro de la subcarpeta 'imagenes/' del bucket 'reportes'.
CREATE POLICY "Permitir subir imagenes de reportes"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'reportes'
    AND (name LIKE 'imagenes/%' OR (storage.foldername(name))[1] = 'imagenes')
  );

-- NOTA DE SEGURIDAD (SOBRESCRITURAS Y ELIMINACIONES):
-- No se definen políticas de UPDATE ni DELETE para los roles 'anon' ni 'authenticated'.
-- Bajo el modelo RLS de PostgreSQL/Supabase, la ausencia de políticas deniega por defecto
-- cualquier intento de modificación o borrado de archivos por parte de usuarios públicos.

COMMIT;
