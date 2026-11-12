-- ==============================================================================
-- ETAPA 1: SEGURIDAD DEL SISTEMA - PROYECTO VENUS
-- ==============================================================================
-- Este script configura las políticas Row Level Security (RLS) y restricciones
-- de almacenamiento para garantizar la integridad de los datos manteniendo el
-- acceso público de lectura y el envío de reportes ciudadanos sin login.
--
-- INSTRUCCIONES:
-- 1. Iniciar sesión en el panel de Supabase (https://supabase.com/dashboard).
-- 2. Ir a SQL Editor -> New Query.
-- 3. Pegar y ejecutar este script completo.
-- ==============================================================================

-- 1. TABLA 'reportes'
-- ------------------------------------------------------------------------------
ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;

-- 1.1 Lectura pública: permite al mapa y a la lista consultar los reportes
DROP POLICY IF EXISTS "Permitir lectura publica de reportes" ON public.reportes;
CREATE POLICY "Permitir lectura publica de reportes"
  ON public.reportes
  FOR SELECT
  TO public
  USING (true);

-- 1.2 Inserción ciudadana: permite a cualquier visitante (anon y autenticado) enviar reportes,
-- pero aplicando validaciones estrictas a nivel de base de datos para prevenir adulteraciones
DROP POLICY IF EXISTS "Permitir insercion ciudadana de reportes" ON public.reportes;
CREATE POLICY "Permitir insercion ciudadana de reportes"
  ON public.reportes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    -- El estado inicial SIEMPRE debe ser 'pendiente'
    estado = 'pendiente'
    -- Coordenadas obligatorias y dentro de límites geográficos estándar
    AND latitud IS NOT NULL AND latitud BETWEEN -90 AND 90
    AND longitud IS NOT NULL AND longitud BETWEEN -180 AND 180
    -- Límite de seguridad para evitar textos maliciosos desmedidos
    AND (descripcion IS NULL OR length(descripcion) <= 1000)
    -- Evidencia fotográfica requerida
    AND imagen_url IS NOT NULL
    -- Restringir tipo de archivo a imagen para reportes nuevos
    AND (archivo_tipo IS NULL OR archivo_tipo = 'imagen')
  );

-- NOTA: No se crean políticas de UPDATE ni DELETE para el rol público (anon).
-- En Supabase RLS, la ausencia de política para una operación deniega el acceso automáticamente.
-- En la Etapa 4 se creará la política de UPDATE exclusiva para el rol administrador.


-- 2. TABLAS DE DATOS HISTÓRICOS ('dataset_principal' y 'noticias_historicas')
-- ------------------------------------------------------------------------------
ALTER TABLE public.dataset_principal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.noticias_historicas ENABLE ROW LEVEL SECURITY;

-- 2.1 Solo lectura pública
DROP POLICY IF EXISTS "Permitir lectura publica dataset_principal" ON public.dataset_principal;
CREATE POLICY "Permitir lectura publica dataset_principal"
  ON public.dataset_principal
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Permitir lectura publica noticias_historicas" ON public.noticias_historicas;
CREATE POLICY "Permitir lectura publica noticias_historicas"
  ON public.noticias_historicas
  FOR SELECT
  TO public
  USING (true);

-- NOTA: Al no existir políticas de INSERT, UPDATE o DELETE para estas tablas,
-- quedan blindadas contra modificaciones no autorizadas desde el cliente.


-- 3. ALMACENAMIENTO (STORAGE BUCKET 'reportes')
-- ------------------------------------------------------------------------------
-- 3.1 Configurar restricciones en el bucket: límite de 10 MB y formatos de imagen permitidos
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB en bytes
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'reportes';

-- 3.2 Permitir lectura pública de las imágenes almacenadas
DROP POLICY IF EXISTS "Permitir lectura publica de imagenes reportes" ON storage.objects;
CREATE POLICY "Permitir lectura publica de imagenes reportes"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'reportes');

-- 3.3 Permitir a los ciudadanos subir imágenes únicamente en la carpeta 'imagenes/'
DROP POLICY IF EXISTS "Permitir subida de imagenes en reportes" ON storage.objects;
CREATE POLICY "Permitir subida de imagenes en reportes"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'reportes'
    AND name LIKE 'imagenes/%'
  );
