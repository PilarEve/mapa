'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';

const ALLOWED_HOSTS = new Set([
  'maps.app.goo.gl',
  'goo.gl',
  'www.google.com',
  'google.com',
  'maps.google.com',
  'www.google.com.py',
  'google.com.py',
  'maps.google.com.py',
]);

const ORIGENES_VALIDOS = [
  'whatsapp_manual',
  'redes_sociales',
  'observacion_campo',
  'otro',
] as const;

export type OrigenManual = (typeof ORIGENES_VALIDOS)[number];

const AFECTACIONES_VALIDAS = new Set([
  'Calle inundada',
  'Deslizamiento',
  'Árbol caído',
  'Vivienda afectada',
  'Vehículo afectado',
  'Persona atrapada',
  'Fallecimiento reportado',
  'Interrupción de tránsito',
  'Servicio público afectado',
  'Acumulación de basura',
  'Sin daños visibles',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractManualStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prefix = `${base}/storage/v1/object/public/reportes/`;
  if (!base || !url.startsWith(prefix)) return null;
  try {
    const path = decodeURIComponent(url.slice(prefix.length).split('?')[0]);
    if (!path.startsWith('imagenes/manuales/') || path.includes('..') || path.includes('//')) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

export async function resolveGoogleMapsShortUrl(
  rawUrl: string
): Promise<{ finalUrl?: string; htmlSnippet?: string; error?: string }> {
  await requireAdmin();

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { error: 'El enlace ingresado no es una URL válida.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { error: 'Protocolo no permitido.' };
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { error: 'Solo se admiten enlaces de Google Maps.' };
  }

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VenusAdminGeolocator/1.0)',
        'Accept-Language': 'es-PY,es;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });

    const finalUrl = response.url;
    const text = await response.text();
    const snippet = text.slice(0, 12000);

    return { finalUrl, htmlSnippet: snippet };
  } catch {
    return { error: 'No se pudo resolver el enlace acortado. Pegá el enlace completo desde la barra del navegador.' };
  }
}

export interface GuardarReporteManualInput {
  latitud: number;
  longitud: number;
  imagenUrl: string;
  uploadedStoragePath?: string | null;
  fechaEventoIso: string;
  origenManual: string;
  afectaciones: string[];
  descripcion?: string | null;
  idempotenciaToken: string;
}

export async function crearReporteManual(
  input: GuardarReporteManualInput
): Promise<{ ok: boolean; id?: string; message: string }> {
  const { supabase, user } = await requireAdmin();

  const cleanupUpload = async () => {
    const path = input.uploadedStoragePath || extractManualStoragePath(input.imagenUrl);
    if (path) {
      await supabase.storage.from('reportes').remove([path]).catch(() => {});
    }
  };

  if (
    typeof input.latitud !== 'number' ||
    typeof input.longitud !== 'number' ||
    Number.isNaN(input.latitud) ||
    Number.isNaN(input.longitud) ||
    input.latitud < -90 ||
    input.latitud > 90 ||
    input.longitud < -180 ||
    input.longitud > 180
  ) {
    await cleanupUpload();
    return { ok: false, message: 'Las coordenadas de ubicación no son válidas.' };
  }

  if (!input.imagenUrl || !extractManualStoragePath(input.imagenUrl)) {
    await cleanupUpload();
    return { ok: false, message: 'La URL de la fotografía no es válida.' };
  }

  const fechaEvento = new Date(input.fechaEventoIso);
  if (Number.isNaN(fechaEvento.getTime())) {
    await cleanupUpload();
    return { ok: false, message: 'La fecha y hora del evento no son válidas.' };
  }

  if (!ORIGENES_VALIDOS.includes(input.origenManual as OrigenManual)) {
    await cleanupUpload();
    return { ok: false, message: 'El origen seleccionado no es válido.' };
  }

  if (!UUID_RE.test(input.idempotenciaToken)) {
    await cleanupUpload();
    return { ok: false, message: 'Token de validación inválido. Recargá la página e intentá nuevamente.' };
  }

  const afectacionesLimpias = Array.from(
    new Set((input.afectaciones ?? []).filter((a) => AFECTACIONES_VALIDAS.has(a)))
  ).slice(0, 11);

  const descripcionLimpia = input.descripcion?.trim() ? input.descripcion.trim().slice(0, 1000) : null;
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('reportes_manual')
    .insert({
      latitud: input.latitud,
      longitud: input.longitud,
      imagen_url: input.imagenUrl,
      archivo_tipo: 'imagen',
      estado: 'validado',
      afectaciones: afectacionesLimpias,
      descripcion: descripcionLimpia,
      fecha_evento: fechaEvento.toISOString(),
      origen_manual: input.origenManual,
      creado_por: user.id,
      revisado_por: user.id,
      revisado_en: nowIso,
      idempotencia_token: input.idempotenciaToken,
    })
    .select('id')
    .single();

  if (error) {
    // Si ya se insertó con el mismo idempotencia_token (doble envío), tratar como éxito sin borrar la foto
    if (error.code === '23505') {
      revalidatePath('/admin/manuales');
      return { ok: true, message: 'Reporte guardado correctamente.' };
    }
    console.error('[admin/carga-manual] error al insertar:', { code: error.code, message: error.message });
    await cleanupUpload();
    return { ok: false, message: `No se pudo guardar el reporte: ${error.message}` };
  }

  revalidatePath('/admin/manuales');
  return { ok: true, id: String(data.id), message: 'Reporte manual guardado como validado.' };
}

export interface ActualizarReporteManualInput {
  id: string;
  latitud: number;
  longitud: number;
  imagenUrl: string;
  newUploadedStoragePath?: string | null;
  fechaEventoIso: string;
  origenManual: string;
  afectaciones: string[];
  descripcion?: string | null;
}

export async function actualizarReporteManual(
  input: ActualizarReporteManualInput
): Promise<{ ok: boolean; message: string }> {
  const { supabase, user } = await requireAdmin();

  const cleanupNewUpload = async () => {
    if (input.newUploadedStoragePath && input.newUploadedStoragePath.startsWith('imagenes/manuales/')) {
      await supabase.storage.from('reportes').remove([input.newUploadedStoragePath]).catch(() => {});
    }
  };

  if (!UUID_RE.test(input.id)) {
    await cleanupNewUpload();
    return { ok: false, message: 'Identificador de reporte inválido.' };
  }

  if (
    typeof input.latitud !== 'number' ||
    typeof input.longitud !== 'number' ||
    Number.isNaN(input.latitud) ||
    Number.isNaN(input.longitud) ||
    input.latitud < -90 ||
    input.latitud > 90 ||
    input.longitud < -180 ||
    input.longitud > 180
  ) {
    await cleanupNewUpload();
    return { ok: false, message: 'Las coordenadas de ubicación no son válidas.' };
  }

  const fechaEvento = new Date(input.fechaEventoIso);
  if (Number.isNaN(fechaEvento.getTime())) {
    await cleanupNewUpload();
    return { ok: false, message: 'La fecha y hora del evento no son válidas.' };
  }

  if (!ORIGENES_VALIDOS.includes(input.origenManual as OrigenManual)) {
    await cleanupNewUpload();
    return { ok: false, message: 'El origen seleccionado no es válido.' };
  }

  const { data: actual, error: fetchErr } = await supabase
    .from('reportes_manual')
    .select('id, imagen_url')
    .eq('id', input.id)
    .maybeSingle();

  if (fetchErr || !actual) {
    await cleanupNewUpload();
    return { ok: false, message: 'No se encontró el reporte manual a editar.' };
  }

  const nuevaImagenUrl = input.imagenUrl.trim();
  if (!nuevaImagenUrl) {
    await cleanupNewUpload();
    return { ok: false, message: 'El reporte debe conservar o incluir una fotografía.' };
  }

  // Si se subió una nueva imagen, debe pertenecer al directorio manuales del bucket
  if (nuevaImagenUrl !== actual.imagen_url && !extractManualStoragePath(nuevaImagenUrl)) {
    await cleanupNewUpload();
    return { ok: false, message: 'La nueva URL de la fotografía no es válida.' };
  }

  const afectacionesLimpias = Array.from(
    new Set((input.afectaciones ?? []).filter((a) => AFECTACIONES_VALIDAS.has(a)))
  ).slice(0, 11);
  const descripcionLimpia = input.descripcion?.trim() ? input.descripcion.trim().slice(0, 1000) : null;

  const { error: updErr } = await supabase
    .from('reportes_manual')
    .update({
      latitud: input.latitud,
      longitud: input.longitud,
      imagen_url: nuevaImagenUrl,
      afectaciones: afectacionesLimpias,
      descripcion: descripcionLimpia,
      fecha_evento: fechaEvento.toISOString(),
      origen_manual: input.origenManual,
      revisado_por: user.id,
      revisado_en: new Date().toISOString(),
    })
    .eq('id', input.id);

  if (updErr) {
    console.error('[admin/carga-manual] error al actualizar:', { code: updErr.code, message: updErr.message });
    await cleanupNewUpload();
    return { ok: false, message: `No se pudo actualizar el reporte: ${updErr.message}` };
  }

  // Si reemplazó la foto, retirar la anterior de Storage
  if (nuevaImagenUrl !== actual.imagen_url) {
    const oldPath = extractManualStoragePath(actual.imagen_url);
    if (oldPath) {
      await supabase.storage.from('reportes').remove([oldPath]).catch(() => {});
    }
  }

  revalidatePath('/admin/manuales');
  revalidatePath('/admin/carga-manual');
  return { ok: true, message: 'Reporte actualizado correctamente.' };
}
