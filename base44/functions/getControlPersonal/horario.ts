import { lista, HttpError } from './util.ts';
import { hm, DIAS } from './tiempo.ts';

export async function cargarHorario(sb: any, sector: string) {
  const res = await sb.entities.HorarioSector.filter({ sector_id: sector }, { sort: '-updated_date', limit: 5 });
  return lista(res)[0] || null;
}

// Un horario cuenta para cálculos solo si está activo, con hora válida y días.
export const horarioVigente = (h: any) =>
  h && h.activo !== false && hm(h.hora_entrada) != null && (h.dias_laborales || []).length ? h : null;

export const leanHorario = (h: any) => h && ({
  id: h.id, hora_entrada: h.hora_entrada, hora_salida: h.hora_salida,
  dias_laborales: h.dias_laborales || [], tolerancia_minutos: Number(h.tolerancia_minutos) || 0,
  activo: h.activo !== false,
});

export async function accionHorario(sb: any, scope: any) {
  return { horario: leanHorario(await cargarHorario(sb, scope.sector)), puedeEditar: scope.canEditHorario };
}

export async function accionGuardarHorario(sb: any, scope: any, body: any) {
  if (!scope.canEditHorario) throw new HttpError(403, 'Solo admin y gerente pueden editar el horario.');
  const { hora_entrada, hora_salida } = body;
  if (hm(hora_entrada) == null || hm(hora_salida) == null) throw new HttpError(400, 'Las horas deben tener formato HH:MM.');
  const dias = Array.isArray(body.dias_laborales) ? body.dias_laborales.filter((d: string) => DIAS.includes(d)) : [];
  if (!dias.length) throw new HttpError(400, 'Elegí al menos un día laboral.');
  const tol = Number(body.tolerancia_minutos);
  if (!Number.isFinite(tol) || tol < 0 || tol > 240) throw new HttpError(400, 'La tolerancia debe estar entre 0 y 240 minutos.');
  const data = { hora_entrada, hora_salida, dias_laborales: [...new Set(dias)], tolerancia_minutos: Math.round(tol), activo: body.activo !== false };
  const actual = await cargarHorario(sb, scope.sector);
  const saved = actual
    ? await sb.entities.HorarioSector.update(actual.id, data)
    : await sb.entities.HorarioSector.create({ ...data, sector_id: scope.sector });
  return { horario: leanHorario({ ...(actual || {}), ...saved, ...data }) };
}