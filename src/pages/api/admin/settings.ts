import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const min_notice_days = Number(form.get('min_notice_days'));

  if (!Number.isFinite(min_notice_days) || min_notice_days < 0) {
    return redirect(`/admin/ajustes?error=${encodeURIComponent('Valor inválido')}`);
  }

  const { error } = await locals.supabase
    .from('app_settings')
    .update({ min_notice_days })
    .eq('id', 1);

  if (error) {
    return redirect(`/admin/ajustes?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/ajustes?ok=1');
};
