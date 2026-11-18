// Verificación del Arranque rápido (solo administradores): una vez por sesión
// y en segundo plano compara cada dato del camino rápido con el de siempre.
// Ante una diferencia se aplican los valores de siempre y ese punto vuelve al
// camino de siempre por el resto de la sesión.
import { base44 } from '@/api/base44Client';
import { queryClientInstance } from '@/lib/query-client';
import {
  ME_KEY, SECTORES_KEY, estadoDe, registrarVerificacion,
  getEmpleadosDerivados, vinculoPintado, llamarVinculo,
} from '@/lib/arranqueRapido';

const json = (v) => JSON.stringify(v ?? null);

// Campo por campo (sin updated_date). viejo = camino de siempre.
function compararObjeto(item, nuevo, viejo) {
  const claves = new Set([...Object.keys(nuevo || {}), ...Object.keys(viejo || {})]);
  claves.delete('updated_date');
  return [...claves]
    .filter((k) => json(nuevo?.[k]) !== json(viejo?.[k]))
    .map((k) => ({ item, campo: k, viejo: viejo?.[k], nuevo: nuevo?.[k] }));
}

function compararLista(item, nueva, vieja) {
  const ids = (l) => l.map((r) => r.id).join(',');
  if (ids(nueva) !== ids(vieja)) {
    return [{ item, campo: 'lista', viejo: `${vieja.length} registros`, nuevo: `${nueva.length} registros` }];
  }
  return nueva.flatMap((r, i) =>
    compararObjeto(item, r, vieja[i]).map((d) => ({ ...d, campo: `${r.clave || r.full_name || r.id} · ${d.campo}` }))
  );
}

// Cada chequeo devuelve null si en esta carga no hay nada que comparar.
const CHEQUEOS = {
  contador: async () => {
    const [vieja, nueva] = await Promise.all([
      base44.functions.invoke('gestionarSolicitudesCert', { operation: 'list' }),
      base44.functions.invoke('contarSolicitudesPendientes', {}),
    ]);
    const viejo = (vieja.data?.solicitudes || [])
      .filter((s) => s.estado === 'enviada' || s.estado === 'en_revision').length;
    const nuevo = nueva.data?.pendientes;
    return { difs: viejo === nuevo ? [] : [{ item: 'Insignia de aprobaciones', campo: 'pendientes', viejo, nuevo }] };
  },
  me: async () => {
    const compartido = queryClientInstance.getQueryData(ME_KEY);
    if (!compartido) return null;
    const real = await base44.auth.me();
    return {
      difs: compararObjeto('Usuario', compartido, real),
      aplicar: () => queryClientInstance.setQueryData(ME_KEY, real),
    };
  },
  sectores: async () => {
    const cache = queryClientInstance.getQueryData(SECTORES_KEY);
    if (!cache) return null;
    const real = await base44.entities.Sector.list('orden', 100);
    return {
      difs: compararLista('Sectores', cache, real),
      aplicar: () => queryClientInstance.setQueryData(SECTORES_KEY, real),
    };
  },
  empleados: async () => {
    const derivados = getEmpleadosDerivados();
    if (!derivados) return null;
    const real = await base44.entities.Employee.list('-updated_date', 200);
    return {
      difs: compararLista('Empleados', derivados, real),
      aplicar: () => queryClientInstance.setQueryData(['employees'], real),
    };
  },
  // La vinculación se revalida en cada carga con la llamada de siempre y la
  // sesión toma ese resultado: queda verificada cuando esa llamada responde.
  vinculo: async ({ user }) => {
    if (!vinculoPintado()) return null;
    const real = await llamarVinculo(user.id).catch(() => null);
    return real ? { difs: [] } : null;
  },
};

let enCurso = false;

export async function verificarArranque(ctx) {
  if (enCurso) return;
  enCurso = true;
  try {
    for (const [item, chequeo] of Object.entries(CHEQUEOS)) {
      if (estadoDe(ctx.user.id).hechos[item]) continue;
      try {
        const res = await chequeo(ctx);
        if (!res) continue;
        registrarVerificacion(ctx.user.id, item, res.difs);
        if (res.difs.length && res.aplicar) await res.aplicar();
      } catch {
        // Sin red o error: se reintenta en la próxima carga de la sesión.
      }
    }
  } finally {
    enCurso = false;
  }
}