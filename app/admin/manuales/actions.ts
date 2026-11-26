'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';

export type ManualActionResult = { ok: boolean; message: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUTA = '/admin/manuales';

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

export async function cambiarEstadoReporteManual(
  id: string,
  nuevoEstado: 'validado' | 'rechazado' | 'pendiente'
): Promise<ManualActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };
  if (!['validado', 'rechazado', 'pendiente'].includes(nuevoEstado)) {
    return { ok: false, message: 'Estado inválido.' };
  }

  const { data, error } = await supabase
    .from('reportes_manual')
    .update({
      estado: nuevoEstado,
      revisado_por: user.id,
      revisado_en: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[admin/manuales] cambiarEstado falló:', { id, code: error.code, message: error.message });
    return { ok: false, message: `No se pudo cambiar el estado: ${error.message}` };
  }

  revalidatePath(RUTA);
  if (!data || data.length === 0) {
    return { ok: false, message: 'No se encontró el reporte.' };
  }

  const labels = {
    validado: 'Reporte aprobado y marcado como validado.',
    rechazado: 'Reporte marcado como rechazado.',
    pendiente: 'Reporte movido a pendientes.',
  };
  return { ok: true, message: labels[nuevoEstado] };
}

export async function eliminarReporteManual(id: string): Promise<ManualActionResult> {
  const { supabase } = await requireAdmin();
  if (!UUID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  const { data: row, error: fetchErr } = await supabase
    .from('reportes_manual')
    .select('id, imagen_url')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr || !row) {
    return { ok: false, message: 'El reporte ya no existe o no se pudo consultar.' };
  }

  const { error: delErr } = await supabase
    .from('reportes_manual')
    .delete()
    .eq('id', id);

  if (delErr) {
    console.error('[admin/manuales] eliminar falló:', { id, code: delErr.code, message: delErr.message });
    return { ok: false, message: `No se pudo eliminar el reporte: ${delErr.message}` };
  }

  const storagePath = extractManualStoragePath(row.imagen_url);
  if (storagePath) {
    await supabase.storage.from('reportes').remove([storagePath]).catch((e) => {
      console.warn('[admin/manuales] aviso al borrar archivo en Storage:', e);
    });
  }

  revalidatePath(RUTA);
  return { ok: true, message: 'Reporte eliminado correctamente.' };
}
