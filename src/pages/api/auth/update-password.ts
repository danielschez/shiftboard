import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = createSupabaseServerClient(request, cookies);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect('/admin/login');

  const form = await request.formData();
  const password = form.get('password')?.toString() ?? '';
  const confirm = form.get('confirm')?.toString() ?? '';
  const back = (msg: string) => redirect(`/admin/nueva-contrasena?error=${encodeURIComponent(msg)}`);

  if (password.length < 8) return back('La contraseña debe tener al menos 8 caracteres');
  if (password !== confirm) return back('Las contraseñas no coinciden');

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return back(error.message);

  return redirect('/admin');
};
