-- ==============================================================================
-- ETAPA 1 - BLOQUE 2: SEGURIDAD DE SUPABASE STORAGE - PROYECTO VENUS
-- ==============================================================================
-- Este script configura la infraestructura de almacenamiento de fotografías:
-- 1. Bucket público 'reportes' para fotografías de reportes pendientes y validados.
-- 2. Bucket privado 'reportes-privados' para fotografías de reportes rechazados
--    (conservación segura de evidencias para moderación en Etapa 4).
-- 3. Políticas RLS en storage.objects para proteger la integridad de los archivos.
--
-- LÍMITES Y FORMATOS:
-- - Límite de tamaño: 50 MB (52428800 bytes, límite técnico efectivo de infraestructura Supabase).
-- - Formatos permitidos: JPG, PNG, WEBP, HEIC y HEIF.
-- - No altera archivos existentes ni elimina datos en 'reportes'.
--
-- INSTRUCCIONES:
-- 1. Iniciar sesión en el panel de Supabase (https://supabase.com/dashboard).
-- 2. Ir a SQL Editor -> New Query.
-- 3. Pegar y ejecutar este script completo.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. BUCKET PÚBLICO: 'reportes' (fotografías de reportes pendientes y validados)
-- ------------------------------------------------------------------------------
-- Garantiza que el bucket 'reportes' sea público, admita hasta 50 MB y acepte
-- los 5 formatos fotográficos sin redimensionamiento ni compresión forzada.
UPDATE storage.buckets
SET public = true,
    file_size_limit = 52428800, -- 50 MB en bytes
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ]
WHERE id = 'reportes';


-- ------------------------------------------------------------------------------
-- 2. BUCKET PRIVADO: 'reportes-privados' (preparación para reportes rechazados)
-- ------------------------------------------------------------------------------
-- Se crea como bucket PRIVADO (public = false).
-- En la Etapa 4, cuando un administrador rechace un reporte, la fotografía
-- se trasladará a este bucket mediante la Storage API sin exponerse a internet.
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
    'image/heif'
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
    'image/heif'
  ];


-- ------------------------------------------------------------------------------
-- 3. POLÍTICAS ROW LEVEL SECURITY (RLS) EN storage.objects
-- ------------------------------------------------------------------------------
-- Habilitar RLS en storage.objects si no estuviese habilitado
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3.1 LECTURA PÚBLICA EN BUCKET 'reportes'
-- Permite acceso público de lectura únicamente a los objetos del bucket 'reportes'.
DROP POLICY IF EXISTS "Permitir lectura publica de imagenes reportes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir lectura publica bucket reportes" ON storage.objects;
CREATE POLICY "Permitir lectura publica bucket reportes"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'reportes');

-- 3.2 SUBIDA CIUDADANA EN BUCKET 'reportes'
-- Permite a cualquier usuario (anónimo o autenticado) subir fotografías únicamente
-- a la carpeta 'imagenes/' dentro del bucket 'reportes'.
DROP POLICY IF EXISTS "Permitir subida de imagenes en reportes" ON storage.objects;
DROP POLICY IF EXISTS "Permitir subida ciudadana en reportes" ON storage.objects;
CREATE POLICY "Permitir subida ciudadana en reportes"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'reportes'
    AND (name LIKE 'imagenes/%' OR (storage.foldername(name))[1] = 'imagenes')
  );

-- NOTA DE INTEGRIDAD:
-- En Supabase RLS, al NO existir políticas de UPDATE ni DELETE para los roles
-- 'anon' o 'authenticated' en el bucket 'reportes', los ciudadanos no pueden
-- sobrescribir ni eliminar fotografías una vez enviadas.

-- 3.3 ACCESO ADMINISTRATIVO AL BUCKET PRIVADO 'reportes-privados'
-- Solo los administradores verificados mediante private.es_administrador()
-- podrán consultar, mover o gestionar archivos en 'reportes-privados'.
DROP POLICY IF EXISTS "Permitir acceso administrativo reportes-privados" ON storage.objects;
CREATE POLICY "Permitir acceso administrativo reportes-privados"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'reportes-privados'
    AND private.es_administrador()
  )
  WITH CHECK (
    bucket_id = 'reportes-privados'
    AND private.es_administrador()
  );

COMMIT;
