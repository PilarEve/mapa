import 'server-only';
import { redirect } from 'next/navigation';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * Verifica en la base de datos si el usuario autenticado es administrador.
 * Llama a public.es_administrador_actual(), wrapper de private.es_administrador()
 * (ver supabase/manual/admin_setup.sql). Si falla o no existe, se deniega el acceso.
 */
export async function checkIsAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc('es_administrador_actual');
  if (error) {
    console.error('[admin] Error verificando permisos:', error.message);
    return false;
  }
  return data === true;
}

/**
 * Data Access Layer: exige sesión válida (validada contra Supabase Auth)
 * Y pertenencia a private.administradores. Redirige al login en caso contrario.
 */
export async function requireAdmin(): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect('/admin/login');

  if (!(await checkIsAdmin(supabase))) {
    await supabase.auth.signOut();
    redirect('/admin/login?error=no_autorizado');
  }
  return { supabase, user: data.user };
}

