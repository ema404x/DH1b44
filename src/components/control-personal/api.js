import { base44 } from '@/api/base44Client';

// Todas las lecturas del módulo pasan por el servidor, que aplica la visibilidad.
export async function controlPersonal(action, payload = {}) {
  const res = await base44.functions.invoke('getControlPersonal', { action, ...payload });
  return res.data;
}