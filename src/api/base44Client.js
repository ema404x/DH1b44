import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// ── Auditoría: quién edita o elimina ──────────────────────────────────────
// Los eventos que alimentan la Auditoría no informan quién hizo el cambio.
// Antes de editar o eliminar un registro auditado, el usuario deja una marca
// a su nombre (la plataforma estampa el autor) que el registro de auditoría
// consume. Las creaciones no la necesitan: el registro ya guarda su creador.
// Espejo en servidor: base44/shared/auditActor.ts
const ENTIDADES_AUDITADAS = new Set([
  'WorkOrder', 'Certificado', 'SolicitudCertificado', 'Client',
  'Project', 'Employee', 'Emergencia', 'RolePermission',
  'Asset', 'Material', 'Pendiente', 'AbonoMaestro', 'Informe',
  'RequerimientoCompra', 'OrdenRutina', 'LocationQR', 'EquipamientoCalefaccion',
]);
const entidades = base44.entities;

function conMarcaDeActor(nombre, handler) {
  const envolver = (action) => async (id, ...resto) => {
    // Sin conexión no se puede marcar; la operación sigue igual.
    const marca = navigator.onLine
      ? await entidades.AuditoriaActor.create({ entity_type: nombre, entity_id: id, action }).catch(() => null)
      : null;
    try {
      return await handler[action](id, ...resto);
    } catch (error) {
      if (marca?.id) entidades.AuditoriaActor.delete(marca.id).catch(() => {});
      throw error;
    }
  };
  return { ...handler, update: envolver('update'), delete: envolver('delete') };
}

base44.entities = new Proxy(entidades, {
  get: (target, nombre) =>
    ENTIDADES_AUDITADAS.has(nombre) ? conMarcaDeActor(nombre, target[nombre]) : target[nombre],
});