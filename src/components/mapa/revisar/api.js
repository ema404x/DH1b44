import { base44 } from '@/api/base44Client';

export async function revisarUbicaciones(action, payload = {}) {
  const res = await base44.functions.invoke('revisarUbicaciones', { action, ...payload });
  return res.data;
}

export const errorTexto = (e) => e?.response?.data?.error || e?.message || 'Ocurrió un error';

export const ESTADOS = {
  sin_coordenadas: { label: 'Sin coordenadas', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  mal_ubicada: { label: 'Probablemente mal ubicada', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  ok: { label: 'Coincide con la dirección', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  sin_resultado: { label: 'Dirección no encontrada', cls: 'bg-muted text-muted-foreground border-border' },
  pendiente: { label: 'Falta buscar la dirección', cls: 'bg-muted text-muted-foreground border-border' },
};

export const metros = (m) => (m == null ? '—' : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
export const coordTexto = (lat, lng) => (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Sin coordenadas');