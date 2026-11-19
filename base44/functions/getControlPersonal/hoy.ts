import { isFieldRole } from '../../shared/roles.ts';
import { fetchPaged, ms } from './util.ts';
import { arInfo, inicioDia, sumarDias, esLaboral, limiteEntrada, horarioDelDia } from './tiempo.ts';
import { cargarHorario, horarioVigente, leanHorario } from './horario.ts';
import { leanEmpleado } from './scope.ts';

const revisar = (f: any) => ['pendiente', 'incidencia'].includes(f.estado_admin) || f.salida_omitida;

// Solo pide al servidor los fichajes con entrada de HOY (hora Argentina).
export async function calcularHoy(sb: any, scope: any, ahora = new Date()) {
  const info = arInfo(ahora) as any;
  const fecha = info.fecha;
  const [raw, h] = await Promise.all([
    fetchPaged(sb, 'FichajeUbicacion', {
      sector_id: scope.sector,
      entrada_timestamp: { $gte: inicioDia(fecha), $lt: inicioDia(sumarDias(fecha, 1)) },
    }, 'entrada_timestamp'),
    cargarHorario(sb, scope.sector),
  ]);
  const horario = horarioVigente(h);
  const laboral = horario ? esLaboral(horario, fecha) : false;
  const limite = horario && laboral ? limiteEntrada(horario, fecha) : null;
  const dia = horario && laboral ? horarioDelDia(horario, fecha) : null;
  const horarioHoy = dia ? { hora_entrada: dia.hora_entrada, hora_salida: dia.hora_salida } : null;
  const umbralPasado = Boolean(horario && laboral && info.minutos > (limite as number));

  const fichajes = raw.filter(scope.fichajeVisible).map(scope.leanFichaje);
  const primera = new Map();
  for (const f of fichajes) {
    const p = primera.get(f.persona);
    if (!p || ms(f.entrada_timestamp) < ms(p.entrada_timestamp)) primera.set(f.persona, f);
  }
  if (horario && laboral) {
    for (const f of primera.values()) if ((arInfo(f.entrada_timestamp) as any).minutos > (limite as number)) f.tarde = true;
  }
  const vinieron = new Set(fichajes.map((f: any) => f.persona));
  const noVinieron = umbralPasado
    ? scope.visibleEmployees
      .filter((e: any) => (e.status || 'activo') === 'activo' && isFieldRole(e.role) && !vinieron.has(`e:${e.id}`))
      .map(leanEmpleado)
      .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'es'))
    : [];

  const contadores = {
    enLugar: fichajes.filter((f: any) => f.estado === 'abierta').length,
    seFueron: fichajes.filter((f: any) => f.salida_timestamp && !f.salida_omitida).length,
    tarde: fichajes.filter((f: any) => f.tarde).length,
    noVinieron: noVinieron.length,
    fueraRadio: fichajes.filter((f: any) => f.far).length,
    paraRevisar: fichajes.filter(revisar).length,
  };
  fichajes.sort((a: any, b: any) => ms(b.entrada_timestamp) - ms(a.entrada_timestamp));
  return { fecha, horario: leanHorario(horario), horarioHoy, laboral, umbralPasado, contadores, fichajes, noVinieron };
}

// Aviso de la campana: solo cuenta, nunca falla para quien no tiene acceso.
export async function contarNoFicharon(sb: any, scope: any) {
  const hoy = await calcularHoy(sb, scope);
  return { count: hoy.umbralPasado ? hoy.noVinieron.length : 0, fecha: hoy.fecha };
}