import type { APIRoute } from 'astro';
import * as XLSX from 'xlsx';

export const GET: APIRoute = async ({ url, locals }) => {
  const today = new Date();
  const year = Number(url.searchParams.get('y')) || today.getFullYear();
  const month = Number(url.searchParams.get('m')) || today.getMonth() + 1;

  const rangeStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const rangeEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: rows, error } = await locals.supabase
    .from('events')
    .select('start_date, end_date, justification, note, created_by_name, created_at, collaborators(full_name), event_types(label)')
    .gte('start_date', rangeStart)
    .lte('start_date', rangeEnd)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(`No se pudo generar el archivo: ${error.message}`, { status: 500 });
  }

  const sheetData = (rows ?? []).map((e: any) => ({
    Colaborador: e.collaborators?.full_name ?? 'General',
    'Tipo de evento': e.event_types?.label ?? '',
    'Fecha inicio': e.start_date,
    'Fecha fin': e.end_date,
    Justificación: e.justification ?? '',
    Nota: e.note ?? '',
    'Dado de alta por': e.created_by_name ?? '',
    'Fecha y hora de alta': new Date(e.created_at).toLocaleString('es-MX'),
  }));

  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  worksheet['!cols'] = [
    { wch: 24 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
    { wch: 30 }, { wch: 24 }, { wch: 22 }, { wch: 20 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const filename = `historial-${year}-${String(month).padStart(2, '0')}.xlsx`;

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
};
