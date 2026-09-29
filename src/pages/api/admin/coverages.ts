import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const backup_collaborator_id = form.get('backup_collaborator_id')?.toString();
  const covered_shift_id = form.get('covered_shift_id')?.toString();
  const covered_collaborator_id = form.get('covered_collaborator_id')?.toString() || null;
  const start_date = form.get('start_date')?.toString();
  const end_date = form.get('end_date')?.toString();
  const note = form.get('note')?.toString().trim() || null;

  if (!backup_collaborator_id || !covered_shift_id || !start_date || !end_date) {
    return redirect(`/admin/coberturas?error=${encodeURIComponent('Faltan datos obligatorios')}`);
  }

  const createdByName =
    (locals.user?.user_metadata?.full_name as string | undefined) ?? locals.user?.email ?? null;

  const { error } = await locals.supabase.from('shift_coverages').insert({
    backup_collaborator_id,
    covered_shift_id,
    covered_collaborator_id,
    start_date,
    end_date,
    note,
    created_by: locals.user?.id ?? null,
    created_by_name: createdByName,
  });

  if (error) {
    return redirect(`/admin/coberturas?error=${encodeURIComponent(error.message)}`);
  }

  return redirect('/admin/coberturas?ok=1');
};
