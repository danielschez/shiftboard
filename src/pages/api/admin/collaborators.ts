import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const full_name = form.get('full_name')?.toString().trim();
  const shift_id = form.get('shift_id')?.toString();

  if (!full_name || !shift_id) {
    return redirect(`/admin/colaboradores?error=${encodeURIComponent('Faltan datos')}`);
  }

  const { error } = await locals.supabase.from('collaborators').insert({ full_name, shift_id });

  if (error) {
    return redirect(`/admin/colaboradores?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/colaboradores?ok=1');
};
