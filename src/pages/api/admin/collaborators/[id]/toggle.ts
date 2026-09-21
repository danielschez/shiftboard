import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
  const { id } = params;

  const { data: current, error: fetchError } = await locals.supabase
    .from('collaborators')
    .select('active')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    return redirect(`/admin/colaboradores?error=${encodeURIComponent('Colaborador no encontrado')}`);
  }

  const { error } = await locals.supabase
    .from('collaborators')
    .update({ active: !current.active })
    .eq('id', id);

  if (error) {
    return redirect(`/admin/colaboradores?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/colaboradores?ok=1');
};
