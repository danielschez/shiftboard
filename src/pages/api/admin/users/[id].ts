import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../../lib/supabaseAdmin';

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { id } = params;
  const form = await request.formData();
  const full_name = form.get('full_name')?.toString().trim() || null;
  const role = form.get('role')?.toString();
  const password = form.get('password')?.toString();

  if (role !== 'admin' && role !== 'super_admin') {
    return redirect(`/admin/usuarios?error=${encodeURIComponent('Rol inválido')}`);
  }

  // Evita que un super_admin se quite a sí mismo el rol por accidente y se
  // quede fuera de las secciones que solo puede usar un super_admin.
  if (id === locals.user?.id && role !== 'super_admin') {
    return redirect(`/admin/usuarios?error=${encodeURIComponent('No puedes quitarte a ti mismo el rol de super_admin')}`);
  }

  const { error: profileError } = await locals.supabase
    .from('profiles')
    .update({ full_name, role })
    .eq('id', id);

  if (profileError) {
    return redirect(`/admin/usuarios?error=${encodeURIComponent(profileError.message)}`);
  }

  if (password) {
    if (password.length < 8) {
      return redirect(`/admin/usuarios?error=${encodeURIComponent('La contraseña debe tener al menos 8 caracteres')}`);
    }
    const admin = createSupabaseAdminClient();
    const { error: pwError } = await admin.auth.admin.updateUserById(id as string, {
      password,
      user_metadata: { full_name },
    });
    if (pwError) {
      return redirect(`/admin/usuarios?error=${encodeURIComponent(pwError.message)}`);
    }
  }

  return redirect('/admin/usuarios?ok=1');
};
