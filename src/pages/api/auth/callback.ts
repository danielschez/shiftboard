import type { APIRoute } from 'astro';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '../../../lib/supabase';

const fail = (redirect: (p: string) => Response) =>
  redirect(
    `/admin/olvide-contrasena?error=${encodeURIComponent('El enlace no es válido o ya caducó. Solicita uno nuevo.')}`
  );

// Destino del enlace del correo. Soporta:
//  - ?code=...                       (flujo PKCE, plantilla por defecto)
//  - ?token_hash=...&type=recovery   (plantilla personalizada, funciona desde otro navegador)
export const GET: APIRoute = async ({ request, cookies, redirect, url }) => {
  const supabase = createSupabaseServerClient(request, cookies);

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(redirect);
    return redirect('/admin/nueva-contrasena');
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return fail(redirect);
    return redirect('/admin/nueva-contrasena');
  }

  return fail(redirect);
};
