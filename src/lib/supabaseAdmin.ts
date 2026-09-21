import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con privilegios de administrador (service role key). SOLO se usa
 * dentro de endpoints server-side (src/pages/api/**), nunca en código que
 * corra en el navegador — la service role key ignora RLS por completo.
 *
 * Requiere la variable de entorno SUPABASE_SERVICE_ROLE_KEY (sin prefijo
 * PUBLIC_, para que Vite/Astro nunca la incluya en el bundle del cliente).
 */
export function createSupabaseAdminClient() {
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(import.meta.env.PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
