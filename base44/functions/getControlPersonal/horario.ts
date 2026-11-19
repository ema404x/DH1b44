import { lista, HttpError } from './util.ts';
import { hm, DIAS, tienePorDia } from './tiempo.ts';

// Orden de la semana para elegir el horario "único" de compatibilidad.
const SEMANA = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];

export async function cargarHorario(sb: any, sector: string) {
  const res = await sb.entities.HorarioSector.filter({ sector_id: sector }, { sort: '-updated_date', limit: 5 });
  return lista(res)[0] || null;
}

// Un horario cuenta para cálculos solo si está activo y tiene al menos un día con hora válida.
export const horarioVigente = (h: any) => {
  if (!h || h.activo === false) return null;
  if (tienePorDia(h)) {
    return SEMANA.some((d) => h.horarios_por_dia[d]?.laborable === true && hm(h.horarios_por_dia[d]?.hora_entrada) != null) ? h : null;
  }
  return hm(h.hora_entrada) != null && (h.dias_laborales || []).length ? h : null;
};

export const leanHorario = (h: any) => h && ({
  id: h.id, hora_entrada: h.hora_entrada, hora_salida: h.hora_salida,
  dias_laborales: h.dias_laborales || [], tolerancia_minutos: Number(h.tolerancia_minutos) || 0,
  activo: h.activo !== false, horarios_por_dia: tienePorDia(h) ? h.horarios_por_dia : null,
});

export async function accionHorario(sb: any, scope: any) {
  return { horario: leanHorario(await cargarHorario(sb, scope.sector)), puedeEditar: scope.canEditHorario };
}

// Valida el horario por día y deriva los campos únicos para compatibilidad.
function datosPorDia(pd: any) {
  const out: any = {};
  for (const d of SEMANA) {
    const v = pd[d] || {};
    const laborable = v.laborable === true;
    if (laborable) {
      const e = hm(v.hora_entrada); const s = hm(v.hora_salida);
      if (e == null || s == null) throw new HttpError(400, 'Las horas deben tener formato HH:MM en todos los días laborables.');
      if (s <= e) throw new HttpError(400, 'La salida debe ser posterior a la entrada en cada día laborable.');
    }
    out[d] = { laborable, hora_entrada: String(v.hora_entrada || ''), hora_salida: String(v.hora_salida || '') };
  }
  const laborables = SEMANA.filter((d) => out[d].laborable);
  if (!laborables.length) throw new HttpError(400, 'Marcá al menos un día como laborable.');
  const ref = out[laborables[0]];
  return { horarios_por_dia: out, hora_entrada: ref.hora_entrada, hora_salida: ref.hora_salida, dias_laborales: laborables };
}

function datosUnicos(body: any) {
  const { hora_entrada, hora_salida } = body;
  if (hm(hora_entrada) == null || hm(hora_salida) == null) throw new HttpError(400, 'Las horas deben tener formato HH:MM.');
  const dias = Array.isArray(body.dias_laborales) ? body.dias_laborales.filter((d: string) => DIAS.includes(d)) : [];
  if (!dias.length) throw new HttpError(400, 'Elegí al menos un día laboral.');
  return { hora_entrada, hora_salida, dias_laborales: [...new Set(dias)] };
}

export async function accionGuardarHorario(sb: any, scope: any, body: any) {
  if (!scope.canEditHorario) throw new HttpError(403, 'Solo admin y gerente pueden editar el horario.');
  const base = body.horarios_por_dia && typeof body.horarios_por_dia === 'object' ? datosPorDia(body.horarios_por_dia) : datosUnicos(body);
  const tol = Number(body.tolerancia_minutos);
  if (!Number.isFinite(tol) || tol < 0 || tol > 240) throw new HttpError(400, 'La tolerancia debe estar entre 0 y 240 minutos.');
  const data = { ...base, tolerancia_minutos: Math.round(tol), activo: body.activo !== false };
  const actual = await cargarHorario(sb, scope.sector);
  const saved = actual
    ? await sb.entities.HorarioSector.update(actual.id, data)
    : await sb.entities.HorarioSector.create({ ...data, sector_id: scope.sector });
  return { horario: leanHorario({ ...(actual || {}), ...saved, ...data }) };
}