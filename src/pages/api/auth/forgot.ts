import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
  const form = await request.formData();
  const email = form.get('email')?.toString().trim().toLowerCase() ?? '';

  if (!email) {
    return redirect(`/admin/olvide-contrasena?error=${encodeURIComponent('Ingresa tu correo')}`);
  }

  const supabase = createSupabaseServerClient(request, cookies);

  // Supabase manda el correo con el SMTP configurado en su dashboard.
  // redirectTo debe estar en Authentication -> URL Configuration -> Redirect URLs.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${url.origin}/api/auth/callback`,
  });

  if (error) {
    console.error('resetPasswordForEmail:', error.message);
    // Solo mostramos error visible en el caso de límite de envío; en cualquier
    // otro caso respondemos igual para no revelar qué correos existen.
    if (error.status === 429) {
      return redirect(
        `/admin/olvide-contrasena?error=${encodeURIComponent('Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.')}`
      );
    }
  }

  return redirect('/admin/olvide-contrasena?ok=1');
};
