const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function monthLabel(year: number, month: number) {
  return `${MONTHS[month - 1]} ${year}`;
}

export const dayOfWeekLabels = DOW;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function toISODate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Devuelve un arreglo de fechas (Date) que cubre la cuadrícula completa
 * del mes (incluye días del mes anterior/siguiente para completar semanas),
 * con la semana empezando en lunes. */
export function buildMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month - 1, 1);
  const firstDow = (first.getDay() + 6) % 7; // 0 = lunes
  const gridStart = new Date(year, month - 1, 1 - firstDow);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  }
  return days;
}

export function addMonths(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
