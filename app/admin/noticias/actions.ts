'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';

export type NoticiaActionResult = { ok: boolean; message: string };

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const RUTA = '/admin/noticias';

export async function rechazarNoticia(id: string): Promise<NoticiaActionResult> {
  const { supabase } = await requireAdmin();
  if (!ID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  const { data, error } = await supabase.rpc('rechazar_noticia', { p_id: id });
  if (error) {
    console.error('[admin/noticias] rechazar falló', { id, code: error.code, message: error.message });
    return { ok: false, message: `No se pudo rechazar la noticia. (código: ${error.code ?? 'desconocido'})` };
  }
  revalidatePath(RUTA);
  return data === true
    ? { ok: true, message: 'Noticia rechazada. Ya no aparece en el mapa público.' }
    : { ok: false, message: 'La noticia ya estaba rechazada o no se encontró. Se actualizó la lista.' };
}

export async function restaurarNoticia(id: string): Promise<NoticiaActionResult> {
  const { supabase } = await requireAdmin();
  if (!ID_RE.test(id)) return { ok: false, message: 'Identificador inválido.' };

  const { data, error } = await supabase.rpc('restaurar_noticia', { p_id: id });
  if (error) {
    console.error('[admin/noticias] restaurar falló', { id, code: error.code, message: error.message });
    return { ok: false, message: `No se pudo restaurar la noticia. (código: ${error.code ?? 'desconocido'})` };
  }
  revalidatePath(RUTA);
  return data === true
    ? { ok: true, message: 'Noticia restaurada. Vuelve a aparecer en el mapa público.' }
    : { ok: false, message: 'La noticia ya estaba visible o no se encontró. Se actualizó la lista.' };
}
