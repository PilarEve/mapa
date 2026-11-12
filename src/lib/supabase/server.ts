import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente de Supabase para el servidor (Server Components / Server Actions).
 * Usa únicamente la clave pública (anon/publishable) y la sesión del usuario en cookies.
 * NUNCA usar service_role aquí: la autorización real depende de RLS + private.es_administrador().
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
          }
        },
      },
    }
  );
}

