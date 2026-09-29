import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
  const { id } = params;
  const { error } = await locals.supabase.from('shift_coverages').delete().eq('id', id);

  if (error) {
    return redirect(`/admin/coberturas?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/coberturas?ok=1');
};
