import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '../../../../../lib/supabaseAdmin';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
  const { id } = params;

  if (id === locals.user?.id) {
    return redirect(`/admin/usuarios?error=${encodeURIComponent('No puedes eliminar tu propio usuario')}`);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id as string);

  if (error) {
    return redirect(`/admin/usuarios?error=${encodeURIComponent(error.message)}`);
  }

  // profiles.id -> auth.users.id tiene ON DELETE CASCADE, así que el
  // perfil se elimina solo.
  return redirect('/admin/usuarios?ok=1');
};
