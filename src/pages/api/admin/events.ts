import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData();
  const event_type_id = form.get('event_type_id')?.toString();
  const collaborator_id = form.get('collaborator_id')?.toString() || null;
  const start_date = form.get('start_date')?.toString();
  const end_date = form.get('end_date')?.toString() || start_date;
  const note = form.get('note')?.toString().trim() || null;
  const justification = form.get('justification')?.toString().trim() || null;

  if (!event_type_id || !start_date) {
    return redirect(`/admin/eventos?error=${encodeURIComponent('Faltan datos obligatorios')}`);
  }

  const createdByName =
    (locals.user?.user_metadata?.full_name as string | undefined) ?? locals.user?.email ?? null;

  const { error } = await locals.supabase.from('events').insert({
    event_type_id,
    collaborator_id,
    start_date,
    end_date,
    note,
    justification,
    created_by: locals.user?.id ?? null,
    created_by_name: createdByName,
  });

  if (error) {
    // Los triggers de cobertura de turno (P0001) y de anticipación (P0002)
    // lanzan un error con un mensaje legible; lo mostramos tal cual.
    const message = error.code === 'P0001' || error.code === 'P0002'
      ? error.message
      : `No se pudo guardar el evento: ${error.message}`;
    return redirect(`/admin/eventos?error=${encodeURIComponent(message)}`);
  }

  return redirect('/admin/eventos?ok=1');
};
