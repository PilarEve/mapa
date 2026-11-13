'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';

export type WhatsappActionResult = { ok: boolean; message: string };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const RUTA = '/admin/whatsapp';

export async function aprobarReporteWhatsapp(id: string): Promise<WhatsappActionResult> {
  const { supabase } = await requireAdmin();
  if (!ID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  const { data, error } = await supabase.rpc('aprobar_reporte_whatsapp', { p_id: id });
  if (error) {
    if (error.code === 'PGRST202') {
      const { data: updated, error: updErr } = await supabase
        .from('reportes_whatsapp')
        .update({ estado: 'validado' })
        .eq('id', id)
        .select('id');
      if (!updErr && updated && updated.length > 0) {
        revalidatePath(RUTA);
        return { ok: true, message: 'Reporte aprobado. Ya aparece entre los verificados.' };
      }
      return {
        ok: false,
        message: 'Ejecutá el script supabase/manual/whatsapp_moderacion.sql en el SQL Editor de Supabase.',
      };
    }
    console.error('[admin/whatsapp] aprobar falló', { id, code: error.code, message: error.message });
    return { ok: false, message: `No se pudo aprobar el reporte. (código: ${error.code ?? 'desconocido'})` };
  }

  revalidatePath(RUTA);
  return data === true
    ? { ok: true, message: 'Reporte aprobado. Ya aparece entre los verificados.' }
    : { ok: false, message: 'El reporte ya estaba validado o no se encontró. Se actualizó la lista.' };
}

export async function rechazarReporteWhatsapp(id: string): Promise<WhatsappActionResult> {
  const { supabase } = await requireAdmin();
  if (!ID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  const { data, error } = await supabase.rpc('rechazar_reporte_whatsapp', { p_id: id });
  if (error) {
    if (error.code === 'PGRST202') {
      const { data: updated, error: updErr } = await supabase
        .from('reportes_whatsapp')
        .update({ estado: 'rechazado' })
        .eq('id', id)
        .select('id');
      if (!updErr && updated && updated.length > 0) {
        revalidatePath(RUTA);
        return { ok: true, message: 'Reporte rechazado.' };
      }
      return {
        ok: false,
        message: 'Ejecutá el script supabase/manual/whatsapp_moderacion.sql en el SQL Editor de Supabase.',
      };
    }
    console.error('[admin/whatsapp] rechazar falló', { id, code: error.code, message: error.message });
    return { ok: false, message: `No se pudo rechazar el reporte. (código: ${error.code ?? 'desconocido'})` };
  }

  revalidatePath(RUTA);
  return data === true
    ? { ok: true, message: 'Reporte rechazado.' }
    : { ok: false, message: 'El reporte ya estaba rechazado o no se encontró. Se actualizó la lista.' };
}

export async function restaurarReporteWhatsapp(id: string): Promise<WhatsappActionResult> {
  const { supabase } = await requireAdmin();
  if (!ID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  // Actualiza a 'pendiente' tanto si estaba en 'rechazado' como en 'validado'
  const { data: updated, error: updErr } = await supabase
    .from('reportes_whatsapp')
    .update({ estado: 'pendiente', revisado_por: null, revisado_en: null })
    .eq('id', id)
    .neq('estado', 'pendiente')
    .select('id');

  if (!updErr && updated && updated.length > 0) {
    revalidatePath(RUTA);
    return { ok: true, message: 'Reporte restaurado. Volvió a Pendientes.' };
  }

  const { data, error } = await supabase.rpc('restaurar_reporte_whatsapp', { p_id: id });
  if (error) {
    console.error('[admin/whatsapp] restaurar falló', { id, code: error.code, message: error.message });
    return { ok: false, message: `No se pudo restaurar el reporte. (código: ${error.code ?? 'desconocido'})` };
  }

  revalidatePath(RUTA);
  return data === true
    ? { ok: true, message: 'Reporte restaurado. Volvió a Pendientes.' }
    : { ok: false, message: 'El reporte ya estaba en Pendientes o no se encontró. Se actualizó la lista.' };
}
