import { fetchPaged, HttpError, dniOf, ms } from './util.ts';
import { arInfo, inicioDia, sumarDias, esLaboral, limiteEntrada, lunesDe, horarioDelDia } from './tiempo.ts';
import { cargarHorario, horarioVigente, leanHorario } from './horario.ts';
import { leanEmpleado } from './scope.ts';

const DIAS_PERIODO = 90;

export async function accionPersona(sb: any, scope: any, body: any) {
  const emp = scope.visibleEmployees.find((e: any) => e.id === body.employeeId);
  if (!emp) throw new HttpError(404, 'Operario no encontrado.');
  const hoyInfo = arInfo(new Date()) as any;
  const hoy = hoyInfo.fecha;
  const desde = sumarDias(hoy, -(DIAS_PERIODO - 1));

  const or: any[] = [];
  const dni = dniOf(emp.dni);
  const dnis = [...new Set([dni, emp.dni].filter(Boolean))];
  if (dnis.length) or.push({ dni: { $in: dnis } });
  const nombres = scope.variantesNombre(emp.full_name);
  if (nombres.length) or.push({ operario_nombre: { $in: nombres } });

  const [raw, h] = await Promise.all([
    or.length ? fetchPaged(sb, 'FichajeUbicacion', { sector_id: scope.sector, entrada_timestamp: { $gte: inicioDia(desde) }, $or: or }, '-entrada_timestamp') : [],
    cargarHorario(sb, scope.sector),
  ]);
  const propios = raw.filter((f: any) => scope.matchEmployee(f)?.id === emp.id).map(scope.leanFichaje);
  const horario = horarioVigente(h);

  const lunes = lunesDe(hoy);
  const semanas = Array.from({ length: 8 }, (_, i) => ({ inicio: sumarDias(lunes, -7 * (7 - i)), minutos: 0 }));
  const mesHoy = hoy.slice(0, 7);
  const meses = [2, 1, 0].map((n) => {
    const [y, m] = mesHoy.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 - n, 1));
    return { mes: d.toISOString().slice(0, 7), minutos: 0 };
  });
  const primeraPorDia = new Map();
  let salidasOmitidas = 0; let incidencias = 0;
  for (const f of propios) {
    const fecha = (arInfo(f.entrada_timestamp) as any).fecha;
    const p = primeraPorDia.get(fecha);
    if (!p || ms(f.entrada_timestamp) < ms(p.entrada_timestamp)) primeraPorDia.set(fecha, f);
    if (f.salida_omitida) salidasOmitidas++;
    if (f.estado_admin === 'incidencia') incidencias++;
    if (f.salida_timestamp && !f.salida_omitida) {
      const min = Math.max(0, Math.round((ms(f.salida_timestamp) - ms(f.entrada_timestamp)) / 60000));
      const s = semanas.find((w) => w.inicio === lunesDe(fecha)); if (s) s.minutos += min;
      const m = meses.find((x) => x.mes === fecha.slice(0, 7)); if (m) m.minutos += min;
    }
  }

  let tardanzas = 0; let salidasAnticipadas = 0; const ausenciasFechas: string[] = [];
  if (horario) {
    for (const [fecha, f] of primeraPorDia) {
      if (esLaboral(horario, fecha) && (arInfo(f.entrada_timestamp) as any).minutos > limiteEntrada(horario, fecha)) { tardanzas++; f.tarde = true; }
    }
    // Salida registrada el mismo día antes de la hora de salida de ese día.
    for (const f of propios) {
      if (!f.salida_timestamp || f.salida_omitida) continue;
      const fecha = (arInfo(f.entrada_timestamp) as any).fecha;
      const sal = arInfo(f.salida_timestamp) as any;
      const dia = horarioDelDia(horario, fecha);
      if (dia.laborable && dia.salida != null && sal?.fecha === fecha && sal.minutos < dia.salida) { salidasAnticipadas++; f.salidaAnticipada = true; }
    }
    if ((emp.status || 'activo') === 'activo') {
      const inicioHorario = (arInfo(h.created_date) as any)?.fecha || desde;
      let d = [desde, inicioHorario, emp.hire_date || desde].sort().pop() as string;
      for (; d <= hoy; d = sumarDias(d, 1)) {
        if (!esLaboral(horario, d) || primeraPorDia.has(d)) continue;
        if (d === hoy && !(hoyInfo.minutos > limiteEntrada(horario, hoy))) continue;
        ausenciasFechas.push(d);
      }
    }
  }
  return {
    empleado: leanEmpleado(emp), horario: leanHorario(horario), periodoDias: DIAS_PERIODO,
    semanas, meses, tardanzas, ausencias: ausenciasFechas.length, ausenciasFechas: ausenciasFechas.reverse().slice(0, 30),
    salidasOmitidas, salidasAnticipadas, incidencias, totalFichajes: propios.length, historial: propios.slice(0, 200),
  };
}