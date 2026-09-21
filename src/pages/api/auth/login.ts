import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export const POST: APIRoute = async ({ request, cookies, redirect, clientAddress }) => {
  const form = await request.formData();
  const email = form.get('email')?.toString().trim().toLowerCase() ?? '';
  const password = form.get('password')?.toString() ?? '';

  if (!email || !password) {
    return redirect(`/admin/login?error=${encodeURIComponent('Ingresa correo y contraseña')}`);
  }

  let ip = 'unknown';
  try {
    ip = clientAddress ?? 'unknown';
  } catch {
    // clientAddress puede no estar disponible en algunos entornos locales
  }

  const supabase = createSupabaseServerClient(request, cookies);

  const { data: locked } = await supabase.rpc('login_attempts_locked', {
    p_email: email,
    p_window_minutes: WINDOW_MINUTES,
    p_max_attempts: MAX_ATTEMPTS,
  });

  if (locked) {
    return redirect(
      `/admin/login?error=${encodeURIComponent(`Demasiados intentos fallidos. Espera ${WINDOW_MINUTES} minutos antes de volver a intentar.`)}`
    );
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  await supabase.rpc('register_login_attempt', { p_email: email, p_ip: ip, p_success: !error });

  if (error) {
    const { data: failedCount } = await supabase.rpc('count_recent_failed_attempts', {
      p_email: email,
      p_window_minutes: WINDOW_MINUTES,
    });
    const remaining = Math.max(MAX_ATTEMPTS - (failedCount ?? 0), 0);
    const message =
      remaining > 0
        ? `Credenciales inválidas. Te quedan ${remaining} intento(s) antes del bloqueo temporal.`
        : `Demasiados intentos fallidos. Espera ${WINDOW_MINUTES} minutos antes de volver a intentar.`;
    return redirect(`/admin/login?error=${encodeURIComponent(message)}`);
  }

  return redirect('/admin');
};
