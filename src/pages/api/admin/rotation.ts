import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const rotation_anchor_date = form.get('rotation_anchor_date')?.toString();
  const rotation_period_days = Number(form.get('rotation_period_days'));

  if (!rotation_anchor_date || !Number.isFinite(rotation_period_days) || rotation_period_days < 1) {
    return redirect(`/admin/ajustes?error=${encodeURIComponent('Valor inválido')}`);
  }

  const { error } = await locals.supabase
    .from('app_settings')
    .update({ rotation_anchor_date, rotation_period_days })
    .eq('id', 1);

  if (error) {
    return redirect(`/admin/ajustes?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/ajustes?ok=1');
};
