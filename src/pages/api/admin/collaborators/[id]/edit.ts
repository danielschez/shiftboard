import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ params, request, locals, redirect }) => {
  const { id } = params;
  const form = await request.formData();
  const full_name = form.get('full_name')?.toString().trim();
  const shift_id = form.get('shift_id')?.toString();

  if (!full_name || !shift_id) {
    return redirect(`/admin/colaboradores?error=${encodeURIComponent('Faltan datos')}`);
  }

  const { error } = await locals.supabase
    .from('collaborators')
    .update({ full_name, shift_id })
    .eq('id', id);

  if (error) {
    return redirect(`/admin/colaboradores?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/colaboradores?ok=1');
};
