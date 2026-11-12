-- ==============================================================================
-- DIAGNÓSTICO (SOLO LECTURA) - retiro de la copia pública de reportes rechazados
-- Ejecutar en el SQL Editor. No modifica nada. Reemplazar el id si querés uno concreto.
-- Evalúa, condición por condición, lo mismo que private.puede_retirar_imagen_publica()
-- (sin la comprobación de administrador, que en el SQL Editor no aplica).
-- ==============================================================================
select
  r.id,
  r.estado,
  r.imagen_publica_retirada,
  (r.imagen_sha256 is not null)                                   as c1_tiene_hash,
  (r.imagen_privada_path is not null)                             as c2_tiene_ruta_privada,
  substring(r.imagen_url from '/object/public/reportes/(imagenes/[^?]+)$') as ruta_publica_extraida,
  (pub.name is not null)                                          as c3_objeto_publico_existe,
  (priv.name is not null)                                         as c4_objeto_privado_existe,
  (r.imagen_privada_path =
     'rechazados/' || r.id::text || '/' ||
     substring(substring(r.imagen_url from '/object/public/reportes/(imagenes/[^?]+)$') from 'imagenes/(.+)$')
  )                                                               as c5_ruta_privada_coincide,
  pub.metadata->>'size'      as tam_publico,
  priv.metadata->>'size'     as tam_privado,
  pub.metadata->>'mimetype'  as mime_publico,
  priv.metadata->>'mimetype' as mime_privado
from public.reportes r
left join storage.objects pub
  on pub.bucket_id = 'reportes'
 and pub.name = substring(r.imagen_url from '/object/public/reportes/(imagenes/[^?]+)$')
left join storage.objects priv
  on priv.bucket_id = 'reportes-privados' and priv.name = r.imagen_privada_path
where r.estado = 'rechazado'
order by r.revisado_en desc nulls last
limit 10;

-- Política y función vigentes:
-- select policyname, cmd, qual from pg_policies
--  where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE';
-- select has_function_privilege('authenticated', 'private.puede_retirar_imagen_publica(text)', 'EXECUTE');
-- select has_schema_privilege('authenticated', 'private', 'USAGE');

