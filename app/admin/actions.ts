'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { checkIsAdmin } from '@/lib/admin/auth';

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password || email.length > 254 || password.length > 200) {
    redirect('/admin/login?error=credenciales');
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/admin/login?error=credenciales');

  // Un usuario autenticado que no es administrador NO obtiene acceso.
  if (!(await checkIsAdmin(supabase))) {
    await supabase.auth.signOut();
    redirect('/admin/login?error=no_autorizado');
  }

  redirect('/admin');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

