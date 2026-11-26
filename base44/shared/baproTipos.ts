// Sinónimos de tipo de activo SOLO para importaciones BAPRO (Excel y PDF).
// No toca TYPE_MAP (compartido): si nada coincide, se sigue con TYPE_MAP como siempre.
import { TYPE_MAP, mapEnum } from './excelImport.ts';

const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_\-./]+/g, ' ').replace(/\s+/g, ' ').trim();

// [valor del enum Asset.type, palabras clave]. Orden = prioridad.
const REGLAS: Array<[string, string[]]> = [
  ['instalacion_hvac', ['aire', 'acondicionado', 'split', 'refrigeracion', 'climatizacion', 'calefaccion', 'caldera', 'chiller', 'hvac']],
  ['equipo_electrico', ['electric', 'tablero', 'ups', 'generador', 'grupo electrogeno', 'iluminacion', 'luminaria']],
  ['instalacion_sanitaria', ['sanitar', 'agua', 'bomba', 'cloaca', 'termotanque', 'plomeria']],
  ['equipo_mecanico', ['ascensor', 'montacarga', 'escalera mecanica', 'porton', 'compresor', 'mecanic']],
  ['seguridad', ['incendio', 'matafuego', 'extintor', 'alarma', 'cctv', 'camara', 'seguridad', 'acceso']],
  ['sistemas_informaticos', ['informatic', 'sistemas', 'cajero', 'atm', 'computadora', 'pc', 'servidor', 'red']],
  ['mobiliario', ['mueble', 'mobiliario', 'escritorio', 'silla']],
  ['estructura', ['edificio', 'estructura', 'techo', 'fachada']],
  ['vehiculo', ['vehiculo', 'auto', 'camioneta']],
  ['herramienta', ['herramienta']],
];

// Palabras cortas: solo como palabra completa (evita que "red" coincida con "reductor").
function contiene(texto: string, kw: string): boolean {
  if (kw.length <= 5 && !kw.includes(' ')) return new RegExp(`(^| )${kw}( |$)`).test(texto);
  return texto.includes(kw);
}

function coincidir(valor: unknown): string | null {
  const t = norm(valor);
  if (!t) return null;
  for (const [tipo, kws] of REGLAS) if (kws.some(k => contiene(t, k))) return tipo;
  return null;
}

// Devuelve el tipo a usar para un activo BAPRO (valor de enum, o el texto original).
export function resolverTipoBapro(tipo: unknown, nombre: unknown): string {
  const original = String(tipo ?? '').trim();
  const porTipo = coincidir(original);
  if (porTipo) return porTipo;
  // Si TYPE_MAP ya lo reconoce (y no es 'otro'), se respeta como hoy.
  if (original && mapEnum(original, TYPE_MAP, 'otro') !== 'otro') return original;
  // Sin columna de tipo, o tipo en 'otro': se intenta con el nombre del activo.
  return coincidir(nombre) || original;
}