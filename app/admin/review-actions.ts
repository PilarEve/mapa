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

  // Un reporte restaurado ya tiene hash registrado: su foto pública debe seguir siendo ese original.
  if (row.imagen_sha256 && originalHash !== row.imagen_sha256) {
    return { ok: false, message: 'La fotografía pública no coincide con el original registrado. No se realizaron cambios.' };
  }

  // 1. Reutiliza la copia privada si ya existe (rechazo anterior o intento interrumpido).
  //    Si no existe, la crea sin upsert: nunca sobrescribe. En ambos casos se verifica por hash.
  const privState = await objectState(supabase, PRIVATE_BUCKET, privatePath);
  if (privState === 'permiso' || privState === 'conexion') {
    return { ok: false, message: 'No se pudo consultar el bucket privado. No se realizaron cambios.' };
  }
  if (privState === 'inexistente') {
    const up = await supabase.storage.from(PRIVATE_BUCKET).upload(privatePath, original.buf, {
      contentType: mime,
      upsert: false,
    });
    if (up.error && !/exist|duplicate/i.test(up.error.message)) {
      return { ok: false, message: 'No se pudo copiar la fotografía al bucket privado. No se realizaron cambios.' };
    }
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

type ObjectState = 'existe' | 'inexistente' | 'permiso' | 'conexion';

/**
 * Existencia del objeto consultada a la base de Storage (API list, autenticada con la
 * sesión del administrador): NO usa la URL pública ni el CDN, así que no hay caché.
 * Distingue: existe / inexistente / error de permisos / error de conexión u otro.
 */
async function objectState(supabase: SupabaseClient, bucket: string, path: string): Promise<ObjectState> {
  const slash = path.lastIndexOf('/');
  const folder = slash >= 0 ? path.slice(0, slash) : '';
  const name = path.slice(slash + 1);
  try {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { search: name, limit: 100 });
    if (error) {
      const status = Number((error as { status?: number; statusCode?: number | string }).status ??
        (error as { statusCode?: number | string }).statusCode);
      console.error('[admin/retiro] list error', { bucket, path, status, message: error.message });
      return status === 401 || status === 403 ? 'permiso' : 'conexion';
    }
    return (data ?? []).some((o) => o.name === name) ? 'existe' : 'inexistente';
  } catch (e) {
    console.error('[admin/retiro] list excepción', { bucket, path, message: e instanceof Error ? e.message : String(e) });
    return 'conexion';
  }
}

type RetireStage =
  | 'ok'
  | 'remove_error'
  | 'remove_sin_efecto'
  | 'aun_existe'
  | 'verificacion_permiso'
  | 'verificacion_conexion'
  | 'marcar_error'
  | 'marcar_false';

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
  const before = await objectState(supabase, PUBLIC_BUCKET, publicPath);
  log('estado_antes', { estado: before });
  if (before === 'permiso') return { ok: false, stage: 'verificacion_permiso' };
  if (before === 'conexion') return { ok: false, stage: 'verificacion_conexion' };

  if (before === 'existe') {
    // 1. Borrado: lo autoriza la política vía private.puede_retirar_imagen_publica(name).
    //    Sin permiso, remove() devuelve lista vacía sin error.
    const rm = await supabase.storage.from(PUBLIC_BUCKET).remove([publicPath]);
    log('remove', {
      error: rm.error ? { message: rm.error.message, name: rm.error.name } : null,
      eliminados: rm.data?.map((o) => o.name) ?? null,
    });
    if (rm.error) return { ok: false, stage: 'remove_error' };
    if (!rm.data || rm.data.length === 0) return { ok: false, stage: 'remove_sin_efecto' };

    // 2. Verificar en la base de Storage (no por URL/CDN) que ya no existe
    const after = await objectState(supabase, PUBLIC_BUCKET, publicPath);
    log('estado_despues', { estado: after });
    if (after === 'permiso') return { ok: false, stage: 'verificacion_permiso' };
    if (after === 'conexion') return { ok: false, stage: 'verificacion_conexion' };
    if (after === 'existe') return { ok: false, stage: 'aun_existe' };
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
  aun_existe: 'El borrado se ejecutó pero el objeto sigue existiendo en Storage.',
  verificacion_permiso: 'No se pudo verificar el objeto público: error de permisos.',
  verificacion_conexion: 'No se pudo verificar el objeto público: error de conexión con Storage. Reintentá.',
  marcar_error: 'Se borró la copia pública, pero falló el registro del retiro.',
  marcar_false: 'Se borró la copia pública, pero la base no confirmó el retiro.',
};

/**
 * Restauración segura (rechazado -> pendiente). Se puede reintentar sin riesgo. Orden:
 *  1. Verificar el original privado contra el SHA-256 registrado.
 *  2. Si ya hay un objeto en la ruta pública, debe ser idéntico; nunca se sobrescribe.
 *  3. Marcar el retiro como pendiente vía RPC: si algo falla desde aquí, el panel ofrece
 *     "Reintentar retiro" y la política de borrado existente puede retirar la copia.
 *  4. Subir los mismos bytes (EXIF intacto), sin upsert, y verificarlos por hash.
 *  5. Cambiar el estado vía RPC atómica, que también registra la auditoría.
 * El original privado se conserva siempre como respaldo.
 */
export async function restaurarReporte(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  // La recuperación de un fallo usa el retiro de copia pública, que depende de esta configuración.
  if (!rejectEnabled()) {
    return { ok: false, message: 'La restauración requiere que el rechazo esté habilitado. No se realizaron cambios.' };
  }
  if (!ID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  const row = await fetchRow(supabase, id);
  if (!row) return { ok: false, message: 'Reporte no encontrado.' };
  if (row.estado !== 'rechazado') {
    revalidatePath('/admin');
    return { ok: false, message: 'El reporte ya no está rechazado. Se actualizó la lista.' };
  }
  if (!row.imagen_privada_path || !row.imagen_sha256) {
    return { ok: false, message: 'Este reporte no tiene copia privada registrada. No se realizaron cambios.' };
  }
  const publicPath = publicPathFromUrl(row.imagen_url);
  if (!publicPath) {
    return { ok: false, message: 'No se pudo identificar la ruta pública de la fotografía. No se realizaron cambios.' };
  }

  // 1. Integridad del original
  const original = await download(supabase, PRIVATE_BUCKET, row.imagen_privada_path);
  if (!original) {
    return { ok: false, message: 'No se pudo leer la fotografía original en el bucket privado. No se realizaron cambios.' };
  }
  if (sha256(original.buf) !== row.imagen_sha256) {
    return { ok: false, message: 'La fotografía original no coincide con el hash registrado. No se realizaron cambios.' };
  }
  const mime = resolveMime(original.type, publicPath);
  if (!mime) return { ok: false, message: 'Formato de archivo no admitido. No se realizaron cambios.' };

  const isIdenticalToOriginal = async () => {
    const copy = await download(supabase, PUBLIC_BUCKET, publicPath);
    return !!copy && copy.buf.length === original.buf.length && sha256(copy.buf) === row.imagen_sha256;
  };

  // 2. Identidad de un objeto público ya existente
  const pubState = await objectState(supabase, PUBLIC_BUCKET, publicPath);
  if (pubState === 'permiso' || pubState === 'conexion') {
    return {
      ok: false,
      message: `${STAGE_MESSAGE[pubState === 'permiso' ? 'verificacion_permiso' : 'verificacion_conexion']} No se realizaron cambios.`,
    };
  }
  if (pubState === 'existe' && !(await isIdenticalToOriginal())) {
    return { ok: false, message: 'Ya existe un archivo público distinto en esa ruta. No se sobrescribió ni se realizaron cambios.' };
  }

  // 3. Registrar la intención antes de exponer la fotografía
  const prep = await supabase.rpc('preparar_restauracion_reporte', { p_id: id });
  if (prep.error) {
    console.error('[admin/restaurar] preparar falló', { reporteId: id, code: prep.error.code, message: prep.error.message });
    return {
      ok: false,
      message:
        prep.error.code === 'PGRST202'
          ? 'Falta configurar la restauración en Supabase: ejecutar supabase/manual/reportes_restauracion.sql.'
          : `No se pudo iniciar la restauración. No se realizaron cambios. (código: ${prep.error.code ?? 'desconocido'})`,
    };
  }
  if (prep.data !== true) {
    revalidatePath('/admin');
    return { ok: false, message: 'El reporte ya no está rechazado. Se actualizó la lista.' };
  }

  const uploadPublicCopy = () =>
    supabase.storage.from(PUBLIC_BUCKET).upload(publicPath, original.buf, { contentType: mime, upsert: false });

  /** Vuelve a dejar la fotografía fuera del bucket público. La política de borrado solo lo permite si sigue rechazado. */
  const undoPublicCopy = async (reason: string): Promise<ActionResult> => {
    // Otro retiro simultáneo pudo marcarla como retirada, y la política de borrado exige lo contrario.
    await supabase.rpc('preparar_restauracion_reporte', { p_id: id });
    const retired = await retirePublicCopy(supabase, id, publicPath);
    revalidatePath('/admin');
    if (retired.ok) {
      return { ok: false, message: `${reason} El reporte sigue rechazado y sin copia pública. Podés reintentar.` };
    }
    // Si el borrado fue denegado porque otro administrador ya lo restauró, la copia pública es correcta.
    const latest = await fetchRow(supabase, id);
    if (latest?.estado === 'pendiente') {
      return { ok: true, message: 'Otro administrador ya restauró este reporte y figura en Pendientes.' };
    }
    return {
      ok: false,
      message: `${reason} El reporte sigue rechazado, pero la copia pública NO se pudo retirar (${STAGE_MESSAGE[retired.stage]}). Usá "Reintentar retiro de copia pública".`,
    };
  };

  /** Un retiro simultáneo pudo borrar la copia justo antes de la transición. Ya en pendiente, no se puede volver a borrar. */
  const restoredResult = async (message: string): Promise<ActionResult> => {
    revalidatePath('/admin');
    if ((await objectState(supabase, PUBLIC_BUCKET, publicPath)) !== 'inexistente') return { ok: true, message };
    const up = await uploadPublicCopy();
    if (!up.error && (await isIdenticalToOriginal())) return { ok: true, message };
    console.error('[admin/restaurar] no se pudo reponer la copia pública', { reporteId: id, message: up.error?.message });
    return { ok: false, message: 'El reporte volvió a Pendientes, pero su fotografía pública no está disponible. La original sigue en el bucket privado.' };
  };

  // 4. Copia pública, sin sobrescribir: otra restauración simultánea pudo crearla
  let uploadedHere = false;
  if (pubState === 'inexistente') {
    const up = await uploadPublicCopy();
    if (up.error && !/exist|duplicate/i.test(up.error.message)) {
      console.error('[admin/restaurar] subida falló', { reporteId: id, message: up.error.message });
      return undoPublicCopy('No se pudo copiar la fotografía al bucket público.');
    }
    uploadedHere = !up.error;
  }
  if (!(await isIdenticalToOriginal())) {
    // Solo se retira lo subido en este intento. Otro objeto puede ser ajeno: el reintento de retiro compara el hash.
    if (uploadedHere) return undoPublicCopy('No se pudo comprobar la copia pública.');
    revalidatePath('/admin');
    return {
      ok: false,
      message: 'No se pudo comprobar la copia pública y no se borró nada. El reporte sigue rechazado. Usá "Reintentar retiro de copia pública".',
    };
  }

  // 5. Transición atómica
  const { data, error } = await supabase.rpc('restaurar_reporte', { p_id: id, p_sha256: row.imagen_sha256 });
  if (!error && data === true) {
    return restoredResult('Reporte restaurado. Volvió a Pendientes con su fotografía pública.');
  }
  if (error) {
    console.error('[admin/restaurar] RPC restaurar_reporte falló', { reporteId: id, code: error.code, message: error.message });
  }

  // La RPC pudo confirmarse aunque se perdiera la respuesta, u otro administrador pudo restaurarlo antes.
  const current = await fetchRow(supabase, id);
  if (current?.estado === 'pendiente') {
    return restoredResult('El reporte ya estaba restaurado y figura en Pendientes.');
  }
  if (!current) {
    // El estado es desconocido: no se borra nada. Si sigue rechazado, el panel ofrece el reintento de retiro.
    revalidatePath('/admin');
    return { ok: false, message: 'No se pudo confirmar el estado del reporte. Actualizá la lista: si sigue rechazado, usá "Reintentar retiro de copia pública" o volvé a restaurar.' };
  }
  return undoPublicCopy('No se pudo cambiar el estado del reporte.');
}

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
  // Si el objeto público aún existe, debe ser idéntico a la copia privada; si ya no existe, se continúa.
  const pubState = await objectState(supabase, PUBLIC_BUCKET, publicPath);
  if (pubState === 'permiso' || pubState === 'conexion') {
    return { ok: false, message: STAGE_MESSAGE[pubState === 'permiso' ? 'verificacion_permiso' : 'verificacion_conexion'] };
  }
  if (pubState === 'existe') {
    const pub = await download(supabase, PUBLIC_BUCKET, publicPath);
    if (!pub || pub.buf.length !== priv.buf.length || sha256(pub.buf) !== privHash) {
      return { ok: false, message: 'La copia privada no coincide con la pública. No se borró nada.' };
    }
  }

  const res = await retirePublicCopy(supabase, id, publicPath);
  revalidatePath('/admin');
  return res.ok
    ? { ok: true, message: 'Copia pública retirada.' }
    : { ok: false, message: `No se pudo retirar la copia pública: ${STAGE_MESSAGE[res.stage]}` };
}

