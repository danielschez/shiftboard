import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../lib/supabaseAdmin';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const full_name = form.get('full_name')?.toString().trim();
  const email = form.get('email')?.toString().trim().toLowerCase();
  const password = form.get('password')?.toString() ?? '';
  const role = form.get('role')?.toString();

  if (!full_name || !email || !password || (role !== 'admin' && role !== 'super_admin')) {
    return redirect(`/admin/usuarios?error=${encodeURIComponent('Faltan datos o el rol no es válido')}`);
  }
  if (password.length < 8) {
    return redirect(`/admin/usuarios?error=${encodeURIComponent('La contraseña debe tener al menos 8 caracteres')}`);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (error || !data.user) {
    return redirect(`/admin/usuarios?error=${encodeURIComponent(error?.message ?? 'No se pudo crear el usuario')}`);
  }

  // El trigger on_auth_user_created ya creó el perfil con rol "admin" por
  // defecto; lo dejamos en sync con lo que se pidió en el formulario.
  const { error: profileError } = await locals.supabase
    .from('profiles')
    .update({ role, full_name })
    .eq('id', data.user.id);

  if (profileError) {
    return redirect(`/admin/usuarios?error=${encodeURIComponent(profileError.message)}`);
  }

  return redirect('/admin/usuarios?ok=1');
};
