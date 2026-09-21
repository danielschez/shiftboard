import { createServerClient, parseCookieHeader, type CookieOptionsWithName } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

/**
 * Crea un cliente de Supabase para el contexto de una petición SSR,
 * leyendo/escribiendo la sesión en las cookies del navegador.
 * Se usa tanto en middleware como en endpoints de la API.
 */
export function createSupabaseServerClient(request: Request, cookies: AstroCookies) {
  return createServerClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '');
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookies.set(name, value, options as CookieOptionsWithName);
          });
        },
      },
    }
  );
}
