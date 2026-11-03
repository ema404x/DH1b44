// Espejo de base44/shared/cadenaFirmas.ts para la UI.
const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const esFirmanteFinal = (f) => norm(f?.full_name).includes('juan pablo');

export function firmantesHabilitados(cadena) {
  const pendientes = (cadena || []).filter(f => f?.estado === 'pendiente');
  const otros = pendientes.filter(f => !esFirmanteFinal(f));
  return otros.length > 0 ? otros : pendientes;
}

export function puedeFirmar(cadena, email) {
  const e = (email || '').toLowerCase().trim();
  return firmantesHabilitados(cadena).some(f => (f.email || '').toLowerCase().trim() === e);
}