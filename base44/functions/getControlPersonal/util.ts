// Utilidades internas del módulo Control de Personal.

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const lista = (res: any) => (Array.isArray(res) ? res : res?.items || []);

// Carga paginada por cursor (500 por página). Solo lectura.
export async function fetchPaged(sb: any, entity: string, query: any, sort = '-created_date', maxPages = 40) {
  const out: any[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < maxPages; i++) {
    const opts: any = { sort, limit: 500 };
    if (cursor) opts.cursor = cursor;
    const res = await sb.entities[entity].filter(query, opts);
    if (Array.isArray(res)) { out.push(...res); break; }
    out.push(...(res?.items || []));
    if (!res?.has_more || !res?.next_cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}

export const dniOf = (s: any) => String(s || '').replace(/\D/g, '');

export const esOmitida = (f: any) => Boolean(f?.salida_omitida || f?.estado === 'salida_omitida');

export const ms = (v: any) => {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
};