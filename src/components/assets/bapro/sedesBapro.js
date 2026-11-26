// Utilidades del catálogo de Activos de BAPRO (orden de sedes y búsqueda).

export const TYPE_LABELS = {
  equipo_electrico: 'Eléctrico', equipo_mecanico: 'Mecánico', instalacion_hvac: 'HVAC',
  instalacion_sanitaria: 'Sanitario', estructura: 'Estructura', vehiculo: 'Vehículo',
  herramienta: 'Herramienta', sistemas_informaticos: 'Informático', mobiliario: 'Mobiliario',
  seguridad: 'Seguridad', otro: 'Otro',
};

/** Minúsculas y sin acentos. */
export function normalizarTexto(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

export function esSedeCentral(nombre) {
  return normalizarTexto(nombre) === 'sede central';
}

/** Sede Central primero, después el resto en orden alfabético. */
export function ordenarSedes(sedes) {
  return [...(sedes || [])].sort((a, b) => {
    const ca = esSedeCentral(a.nombre);
    const cb = esSedeCentral(b.nombre);
    if (ca !== cb) return ca ? -1 : 1;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base', numeric: true });
  });
}

/** Texto donde se busca: nombre, código, marca, modelo, serie, área, ubicación, sede y tipo. */
export function textoBusquedaActivo(a, sedeNombre) {
  return normalizarTexto([
    a.name, a.code, a.brand, a.model, a.serial_number, a.area, a.location,
    sedeNombre || a.sede, TYPE_LABELS[a.type] || 'Otro',
  ].filter(Boolean).join(' '));
}

export function tokensBusqueda(q) {
  return normalizarTexto(q).split(' ').filter(Boolean);
}