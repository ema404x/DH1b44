import { format } from 'date-fns';

export const DETALLE_COLORS = {
  'Certificado':     { bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  'En ejecución':    { bg: 'bg-blue-500/15',    text: 'text-blue-300',    dot: 'bg-blue-400' },
  'A ejecutar':      { bg: 'bg-cyan-500/15',     text: 'text-cyan-300',    dot: 'bg-cyan-400' },
  'Presupuestado':   { bg: 'bg-yellow-500/15',   text: 'text-yellow-300',  dot: 'bg-yellow-400' },
  'Rechazado':       { bg: 'bg-red-500/15',      text: 'text-red-300',     dot: 'bg-red-400' },
  'Sin presupuesto': { bg: 'bg-slate-500/15',    text: 'text-slate-300',   dot: 'bg-slate-400' },
  'Sin solicitud':   { bg: 'bg-slate-600/15',    text: 'text-slate-400',   dot: 'bg-slate-500' },
  'Cancelado':       { bg: 'bg-red-900/20',      text: 'text-red-400',     dot: 'bg-red-500' },
  'pendiente':       { bg: 'bg-yellow-500/15',   text: 'text-yellow-300',  dot: 'bg-yellow-400' },
  'en_progreso':     { bg: 'bg-blue-500/15',     text: 'text-blue-300',    dot: 'bg-blue-400' },
  'completado':      { bg: 'bg-emerald-500/15',  text: 'text-emerald-300', dot: 'bg-emerald-400' },
  'cancelado':       { bg: 'bg-red-900/20',      text: 'text-red-400',     dot: 'bg-red-500' },
  'pausado':         { bg: 'bg-slate-500/15',    text: 'text-slate-300',   dot: 'bg-slate-400' },
};

export const STATUS_LABELS = {
  pendiente: 'Pendiente', en_progreso: 'En Progreso', completado: 'Completado',
  cancelado: 'Cancelado', pausado: 'Pausado',
};

export const PROJECT_FIELDS = [
  { key: 'name', label: 'Título obra en SAP', required: true },
  { key: 'code', label: 'Nº Orden SAP', placeholder: '420000000' },
  { key: 'client_name', label: 'Establecimiento' },
  { key: 'address', label: 'Dirección' },
  { key: 'status', label: 'Estado', type: 'select', options: [
    { value: 'pendiente', label: 'Pendiente' }, { value: 'en_progreso', label: 'En Progreso' },
    { value: 'pausado', label: 'Pausado' }, { value: 'completado', label: 'Completado' }, { value: 'cancelado', label: 'Cancelado' },
  ]},
  { key: 'start_date', label: 'AI (Fecha Inicio)', type: 'date' },
  { key: 'end_date', label: 'AR (Fecha Recepción)', type: 'date' },
  { key: 'estimated_budget', label: 'Monto Base Feb-23', type: 'number' },
  { key: 'progress', label: '% Avance', type: 'number' },
  { key: 'notes', label: 'Notas (Jefe Sitio, Inspector, etc.)', type: 'textarea' },
];

export const TABLE_COLS = '28px 48px 1fr 1fr 2fr 80px 90px 110px 70px 70px 100px 120px 120px 32px';

export const TABLE_HEADERS = [
  { k: 'comuna', label: 'COM.' },
  { k: 'address', label: 'DIRECCIÓN' },
  { k: 'client_name', label: 'ESTABLECIMIENTO' },
  { k: 'name', label: 'TÍTULO OBRA EN SAP' },
  { k: 'monto', label: 'MONTO' },
  { k: 'code', label: 'Nº ORDEN' },
  { k: 'detalle', label: 'ESTADO' },
  { k: 'ai', label: 'AI' },
  { k: 'ar', label: 'AR' },
  { k: 'avance', label: '% AVANCE' },
  { k: 'jefe', label: 'JEFE SITIO', hidden: true },
  { k: 'inspector', label: 'INSPECTOR', hidden: true },
  { k: '_', label: '' },
];

function parseNote(notes, key) {
  const m = notes?.match(new RegExp(`${key}:\\s*([^|]+)`));
  return m ? m[1].trim() : '—';
}

export function getDetalle(project) {
  const m = project.notes?.match(/Detalle:\s*([^|]+)/);
  if (m) return m[1].trim();
  return STATUS_LABELS[project.status] || project.status || '—';
}

export const getComuna    = (p) => parseNote(p.notes, 'Comuna');
export const getJefeSitio = (p) => parseNote(p.notes, 'Jefe de Sitio');
export const getInspector = (p) => parseNote(p.notes, 'Inspector');

export function fmtMonto(val) {
  if (!val || val === 0) return '—';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  return `$${val.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

export function fmtFecha(val) {
  if (!val) return '—';
  try {
    // ISO date strings (YYYY-MM-DD) son interpretadas como UTC por JS.
    // Añadir T12:00:00 evita que cambien de día en zonas UTC-x.
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(val) ? val + 'T12:00:00' : val;
    return format(new Date(normalized), 'dd/MM/yy');
  } catch { return '—'; }
}