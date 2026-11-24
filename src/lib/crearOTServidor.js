import { base44 } from '@/api/base44Client';

/** Crea una OT real en el servidor, que verifica WorkOrder.create. */
export async function crearOTServidor(data) {
  const res = await base44.functions.invoke('crearOT', { data });
  if (res?.data?.error) throw new Error(res.data.error);
  if (!res?.data?.ot?.id) throw new Error('El servidor no devolvió la OT creada');
  return res.data.ot;
}