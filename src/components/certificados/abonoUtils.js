// Utilidades compartidas para Abonos Maestros

export const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export const parseMonto = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const clean = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

export const fmt = (v) => {
  const n = parseMonto(v);
  if (!n) return '$ 0';
  const parts = Math.round(Math.abs(n)).toString().split('');
  const result = [];
  parts.reverse().forEach((d, i) => {
    if (i > 0 && i % 3 === 0) result.push('.');
    result.push(d);
  });
  return (n < 0 ? '-' : '') + '$ ' + result.reverse().join('');
};

export const calcularFechas = (fechaOC, duracionMeses) => {
  if (!fechaOC || !duracionMeses) return {};
  const [y, m] = fechaOC.split('-').map(Number);
  let inicioMes = m + 1, inicioYear = y;
  if (inicioMes > 12) { inicioMes = 1; inicioYear++; }
  const fechaInicio = `${inicioYear}-${String(inicioMes).padStart(2, '0')}-01`;
  let finMes = inicioMes + duracionMeses - 1, finYear = inicioYear;
  while (finMes > 12) { finMes -= 12; finYear++; }
  const ultimoDia = new Date(finYear, finMes, 0).getDate();
  const fechaFin = `${finYear}-${String(finMes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
  return { fechaInicio, fechaFin };
};

export const mesPeriodoLabel = (dateStr) => {
  if (!dateStr) return '—';
  const [y, m] = dateStr.split('-').map(Number);
  return `${MESES_ES[m - 1]} ${y}`;
};

export const EMPTY_FORM = {
  contratista: '', oc_numero: '', ada_numero: '', obra_servicio: '',
  emprendimiento: '', monto_total_contrato: '', fecha_oc_emision: '',
  duracion_meses: '', plazo_obra: '', condiciones_pago: '',
  anticipo_pct: 0, fondo_reparo_pct: 0,
  items: [{ descripcion: '', um: 'MES', cantidad: 1, importe_unitario: '', importe_total: 0 }],
  estado: 'activo', notas: '',
};