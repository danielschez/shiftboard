import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const name = form.get('name')?.toString().trim();
  const start_time = form.get('start_time')?.toString();
  const end_time = form.get('end_time')?.toString();

  if (!name || !start_time || !end_time) {
    return redirect(`/admin/turnos?error=${encodeURIComponent('Faltan datos')}`);
  }

  const { error } = await locals.supabase.from('shifts').insert({ name, start_time, end_time });

  if (error) {
    return redirect(`/admin/turnos?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/turnos?ok=1');
};
