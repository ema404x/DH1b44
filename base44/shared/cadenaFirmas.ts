// Reglas de habilitación de la cadena de firmas:
// cualquier firmante pendiente puede firmar en cualquier orden, excepto
// Juan Pablo, que solo se habilita cuando todos los demás ya firmaron.
const norm = (s: string) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const esFirmanteFinal = (f: any) => norm(f?.full_name).includes('juan pablo');

export function firmantesHabilitados(cadena: any[]): any[] {
  const pendientes = (cadena || []).filter(f => f?.estado === 'pendiente');
  const otros = pendientes.filter(f => !esFirmanteFinal(f));
  return otros.length > 0 ? otros : pendientes;
}

export function puedeFirmar(cadena: any[], email: string): boolean {
  const e = (email || '').toLowerCase().trim();
  return firmantesHabilitados(cadena).some(f => (f.email || '').toLowerCase().trim() === e);
}