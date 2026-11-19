/**
 * Propuestas de OT de operarios (SolicitudOT). Nada de esto lee ni escribe
 * WorkOrder: la OT real se crea solo al aprobar, desde el servidor.
 */
import { base44 } from '@/api/base44Client';
import { hasModulePermission, isAdminLevelRole, isJefeSitioRole } from '@/lib/roles';
import { enqueueCreateSolicitudOT } from '@/lib/offlineSyncEngine';

export const MODULE_KEY = 'PropuestasOT';

// Acceso por defecto (mientras el rol no tenga la clave configurada):
// admin, gerente/gerencia y jefe de sitio.
export function propuestasPorDefecto(roleName) {
  return isAdminLevelRole(roleName) || isJefeSitioRole(roleName);
}

export function puedeVerPropuestas(user, userPermissions) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!userPermissions) return false;
  const explicit = userPermissions[MODULE_KEY];
  if (explicit) return hasModulePermission(explicit, 'read', MODULE_KEY);
  return user.role === 'gerente' || user.role === 'jefe_sitio' || propuestasPorDefecto(userPermissions._employeeRole);
}

export const ESTADOS = [
  { key: 'enviada', label: 'Enviadas', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { key: 'aprobada', label: 'Aprobadas', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { key: 'rechazada', label: 'Rechazadas', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
];

export const TIPOS = {
  mantenimiento_preventivo: 'Mant. preventivo',
  mantenimiento_correctivo: 'Mant. correctivo',
  instalacion: 'Instalación',
  inspeccion: 'Inspección',
  reparacion: 'Reparación',
  emergencia: 'Emergencia',
};

export const PRIORIDADES = {
  baja: { label: 'Baja', cls: 'bg-slate-500/15 text-slate-300' },
  media: { label: 'Media', cls: 'bg-blue-500/15 text-blue-400' },
  alta: { label: 'Alta', cls: 'bg-amber-500/15 text-amber-400' },
  urgente: { label: 'Urgente', cls: 'bg-red-500/15 text-red-400' },
};

export async function resolverPropuesta(payload) {
  const res = await base44.functions.invoke('resolverSolicitudOT', payload).catch((e) => {
    // Mostrar el motivo real del servidor, no el genérico "status code 500".
    const d = e?.response?.data;
    throw new Error(d?.error || d?.message || e.message);
  });
  if (res?.data?.error) throw new Error(res.data.error);
  return res.data;
}

/**
 * Envía una propuesta (para la pantalla del operario, parte B).
 * data: { titulo, descripcion, prioridad, tipo, asset_id, location_qr_id, location, fecha_sugerida, fotos }
 * fotosLocales: [{ blob, name }] tomadas sin conexión.
 * offline: true → se encola en la cola durable con sus fotos en el dispositivo.
 */
export async function enviarPropuestaOT(data, fotosLocales = [], { offline = false } = {}) {
  if (offline) {
    const id = await enqueueCreateSolicitudOT(data, fotosLocales);
    return { _offline: true, client_op_id: id };
  }
  const fotos = [...(data.fotos || [])];
  for (const p of fotosLocales) {
    const up = await base44.integrations.Core.UploadPublicFile({ file: p.blob });
    if (!up?.file_url) throw new Error('No se recibió la URL de la foto subida');
    fotos.push(up.file_url);
  }
  const res = await base44.functions.invoke('crearSolicitudOT', {
    ...data,
    fotos,
    client_op_id: crypto.randomUUID(),
  });
  if (res?.data?.error) throw new Error(res.data.error);
  return res.data.solicitud;
}