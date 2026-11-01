'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin/auth';

export type ActionResult = { ok: boolean; message: string };

const PUBLIC_BUCKET = 'reportes';
const PRIVATE_BUCKET = 'reportes-privados';
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const approvalEnabled = () => process.env.ADMIN_APROBACION_HABILITADA === 'true';
const rejectEnabled = () => process.env.ADMIN_RECHAZO_HABILITADO === 'true';

interface Row {
  id: string;
  estado: string;
  imagen_url: string | null;
  imagen_privada_path: string | null;
  imagen_publica_retirada: boolean | null;
  imagen_sha256: string | null;
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
};
const ALLOWED_MIME = new Set(Object.values(MIME_BY_EXT));

/** Tipo MIME del original: el del objeto descargado o, si falta, el deducido de la extensión. */
function resolveMime(blobType: string, path: string): string | null {
  const t = blobType?.toLowerCase();
  if (t && ALLOWED_MIME.has(t)) return t;
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? null;
}

/** Extrae la ruta del objeto en el bucket público desde su URL pública (validada). */
function publicPathFromUrl(url: string | null): string | null {
  if (!url) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prefix = `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/`;
  if (!base || !url.startsWith(prefix)) return null;
  let path: string;
  try {
    path = decodeURIComponent(url.slice(prefix.length).split('?')[0]);
  } catch {
    return null;
  }
  if (!path.startsWith('imagenes/') || path.includes('..') || path.includes('//')) return null;
  return path;
}

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

async function fetchRow(supabase: SupabaseClient, id: string): Promise<Row | null> {
  const { data } = await supabase
    .from('reportes')
    .select('id, estado, imagen_url, imagen_privada_path, imagen_publica_retirada, imagen_sha256')
    .eq('id', id)
    .maybeSingle();
  return (data as Row | null) ?? null;
}

async function download(supabase: SupabaseClient, bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return { buf: Buffer.from(await data.arrayBuffer()), type: data.type };
}

export async function aprobarReporte(id: string): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!approvalEnabled()) {
    return { ok: false, message: 'La aprobación aún no está habilitada (falta configuración en Supabase).' };
  }
  if (!ID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  const { data, error } = await supabase.rpc('aprobar_reporte', { p_id: id });
  if (error) {
    // DIAGNÓSTICO TEMPORAL (solo servidor): sin tokens ni credenciales.
    const { data: isAdm, error: admErr } = await supabase.rpc('es_administrador_actual');
    console.error('[admin/aprobar] RPC aprobar_reporte falló', {
      reporteId: id,
      usuarioId: user.id,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      esAdministradorActual: isAdm,
      esAdministradorError: admErr ? `${admErr.code}: ${admErr.message}` : null,
    });
    return {
      ok: false,
      message: `No se pudo aprobar el reporte. No se realizaron cambios. (código: ${error.code ?? 'desconocido'})`,
    };
  }
  console.info('[admin/aprobar] resultado RPC', { reporteId: id, resultado: data });
  if (data !== true) {
    revalidatePath('/admin');
    return { ok: false, message: 'El reporte ya no estaba pendiente (otro cambio previo). Se actualizó la lista.' };
  }
  revalidatePath('/admin');
  return { ok: true, message: 'Reporte aprobado. Ya aparece entre los verificados.' };
}

/**
 * Rechazo seguro. Orden (el estado cambia solo si todo lo previo se verificó):
 *  1. Copiar bytes originales (EXIF intacto) al bucket PRIVADO y verificar por hash.
 *  2. Cambiar estado vía RPC atómica (solo si sigue 'pendiente').
 *  3. Retirar la copia pública y verificar; si falla, queda marcado para reintento.
 */
export async function rechazarReporte(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!rejectEnabled()) {
    return { ok: false, message: 'El rechazo aún no está habilitado (falta el bucket privado y sus políticas).' };
  }
  if (!ID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  const row = await fetchRow(supabase, id);
  if (!row) return { ok: false, message: 'Reporte no encontrado.' };
  if (row.estado !== 'pendiente') {
    revalidatePath('/admin');
    return { ok: false, message: 'El reporte ya no está pendiente. Se actualizó la lista.' };
  }

  const publicPath = publicPathFromUrl(row.imagen_url);
  if (!publicPath) {
    return { ok: false, message: 'No se pudo identificar la fotografía de forma segura. No se realizaron cambios.' };
  }

  const original = await download(supabase, PUBLIC_BUCKET, publicPath);
  if (!original) return { ok: false, message: 'No se pudo leer la fotografía original. No se realizaron cambios.' };

  const privatePath = `rechazados/${row.id}/${publicPath.slice('imagenes/'.length)}`;

  const mime = resolveMime(original.type, publicPath);
  if (!mime) {
    return { ok: false, message: 'Formato de archivo no admitido. No se realizaron cambios.' };
  }
  const originalHash = sha256(original.buf);

  // 1. Copia al bucket privado (sin upsert: nunca sobrescribe) o reutiliza una previa idéntica.
  const up = await supabase.storage.from(PRIVATE_BUCKET).upload(privatePath, original.buf, {
    contentType: mime,
    upsert: false,
  });
  if (up.error && !/exist|duplicate/i.test(up.error.message)) {
    return { ok: false, message: 'No se pudo copiar la fotografía al bucket privado. No se realizaron cambios.' };
  }
  const copy = await download(supabase, PRIVATE_BUCKET, privatePath);
  if (!copy || copy.buf.length !== original.buf.length || sha256(copy.buf) !== originalHash) {
    return { ok: false, message: 'La copia privada no coincide con el original. No se realizaron cambios.' };
  }

  // 2. Cambio de estado atómico
  const { data, error } = await supabase.rpc('rechazar_reporte', {
    p_id: id,
    p_ruta_privada: privatePath,
    p_sha256: originalHash,
  });
  if (error || data !== true) {
    revalidatePath('/admin');
    return {
      ok: false,
      message: 'No se pudo cambiar el estado (¿modificado por otro administrador?). La foto original sigue intacta.',
    };
  }

  // 3. Retirar copia pública
  const retired = await retirePublicCopy(supabase, id, publicPath);
  revalidatePath('/admin');
  return retired.ok
    ? { ok: true, message: 'Reporte rechazado. La fotografía original se conserva en el bucket privado.' }
    : {
        ok: true,
        message: `Reporte rechazado y oculto, pero la copia pública NO se pudo retirar (${STAGE_MESSAGE[retired.stage]}). Usá "Reintentar retiro de copia pública".`,
      };
}

type RetireStage = 'ok' | 'remove_error' | 'remove_sin_efecto' | 'aun_existe' | 'marcar_error' | 'marcar_false';

/**
 * Retira la copia pública de forma idempotente y con diagnóstico por etapa
 * (solo servidor; no registra tokens ni credenciales).
 * Precondición: el llamador ya verificó la integridad de la copia privada.
 */
async function retirePublicCopy(
  supabase: SupabaseClient,
  id: string,
  publicPath: string
): Promise<{ ok: boolean; stage: RetireStage }> {
  const log = (stage: string, extra: Record<string, unknown> = {}) =>
    console.info('[admin/retiro]', { reporteId: id, publicPath, stage, ...extra });

  // 0. ¿El objeto público todavía existe? (un intento previo pudo borrarlo y fallar después)
  const before = await download(supabase, PUBLIC_BUCKET, publicPath);
  log('existe_antes', { existe: !!before });

  if (before) {
    // 1. Borrado: lo autoriza la política vía private.puede_retirar_imagen_publica(name).
    //    Sin permiso, remove() devuelve lista vacía sin error.
    const rm = await supabase.storage.from(PUBLIC_BUCKET).remove([publicPath]);
    log('remove', {
      error: rm.error ? { message: rm.error.message, name: rm.error.name } : null,
      eliminados: rm.data?.map((o) => o.name) ?? null,
    });
    if (rm.error) return { ok: false, stage: 'remove_error' };
    if (!rm.data || rm.data.length === 0) return { ok: false, stage: 'remove_sin_efecto' };

    // 2. Verificar que ya no existe
    const after = await download(supabase, PUBLIC_BUCKET, publicPath);
    log('existe_despues', { existe: !!after });
    if (after) return { ok: false, stage: 'aun_existe' };
  }

  // 3. Registrar el retiro (la función SQL vuelve a comprobar que el objeto ya no está)
  const { data, error } = await supabase.rpc('marcar_imagen_publica_retirada', { p_id: id });
  log('marcar', {
    resultado: data,
    error: error ? { code: error.code, message: error.message, details: error.details, hint: error.hint } : null,
  });
  if (error) return { ok: false, stage: 'marcar_error' };
  if (data !== true) return { ok: false, stage: 'marcar_false' };
  return { ok: true, stage: 'ok' };
}

const STAGE_MESSAGE: Record<RetireStage, string> = {
  ok: 'ok',
  remove_error: 'Storage devolvió un error al borrar.',
  remove_sin_efecto:
    'Storage no borró nada: la política de borrado no autorizó la operación (revisar private.puede_retirar_imagen_publica).',
  aun_existe: 'El borrado se ejecutó pero el archivo público sigue accesible.',
  marcar_error: 'Se borró la copia pública, pero falló el registro del retiro.',
  marcar_false: 'Se borró la copia pública, pero la base no confirmó el retiro.',
};

/** Reintento idempotente para rechazados cuya copia pública sigue accesible. */
export async function reintentarRetiroPublico(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!rejectEnabled()) return { ok: false, message: 'El rechazo no está habilitado.' };
  if (!ID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  const row = await fetchRow(supabase, id);
  if (!row || row.estado !== 'rechazado' || !row.imagen_privada_path || row.imagen_publica_retirada) {
    return { ok: false, message: 'Este reporte no requiere retiro de copia pública.' };
  }
  const publicPath = publicPathFromUrl(row.imagen_url);
  if (!publicPath) return { ok: false, message: 'No se pudo identificar la copia pública.' };

  // Antes de borrar, confirmar que la copia privada existe y coincide con la pública (si aún existe)
  const priv = await download(supabase, PRIVATE_BUCKET, row.imagen_privada_path);
  if (!priv) return { ok: false, message: 'No se pudo verificar la copia privada. No se borró nada.' };
  const privHash = sha256(priv.buf);
  if (!row.imagen_sha256 || privHash !== row.imagen_sha256) {
    return { ok: false, message: 'La copia privada no coincide con el hash registrado. No se borró nada.' };
  }
  const pub = await download(supabase, PUBLIC_BUCKET, publicPath);
  if (pub && (pub.buf.length !== priv.buf.length || sha256(pub.buf) !== privHash)) {
    return { ok: false, message: 'La copia privada no coincide con la pública. No se borró nada.' };
  }

  const res = await retirePublicCopy(supabase, id, publicPath);
  revalidatePath('/admin');
  return res.ok
    ? { ok: true, message: 'Copia pública retirada.' }
    : { ok: false, message: `No se pudo retirar la copia pública: ${STAGE_MESSAGE[res.stage]}` };
}

