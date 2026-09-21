import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
  const { id } = params;
  const { error } = await locals.supabase.from('collaborators').delete().eq('id', id);

  if (error) {
    return redirect(`/admin/colaboradores?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/colaboradores?ok=1');
};
