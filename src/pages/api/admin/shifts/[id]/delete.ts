import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
  const { id } = params;
  const { error } = await locals.supabase.from('shifts').delete().eq('id', id);

  if (error) {
    // Por ejemplo, si todavía hay colaboradores asignados a este turno (FK restrict)
    return redirect(`/admin/turnos?error=${encodeURIComponent('No se pudo eliminar: revisa que no tenga colaboradores asignados')}`);
  }

  return redirect('/admin/turnos?ok=1');
};
