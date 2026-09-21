import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ params, locals, redirect }) => {
  const { id } = params;
  const { error } = await locals.supabase.from('events').delete().eq('id', id);

  if (error) {
    return redirect(`/admin/eventos?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/eventos?ok=1');
};
