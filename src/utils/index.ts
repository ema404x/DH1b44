export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

export const PUBLIC_PRODUCTION_ORIGIN = 'https://dh1m.com';

/**
 * Devuelve siempre el dominio público canónico (https://dh1m.com) para QRs y links compartibles.
 */
export function getPublicAppOrigin(): string {
    return PUBLIC_PRODUCTION_ORIGIN;
}

/**
 * Normaliza cualquier URL o ruta de QR para que siempre apunte a https://dh1m.com
 * conservando pathname, query params y hash.
 */
export function toPublicQrUrl(pathOrUrl: string): string {
    const raw = (pathOrUrl || '').trim();
    if (!raw) return '';
    try {
        const parsed = new URL(raw, PUBLIC_PRODUCTION_ORIGIN);
        return `${PUBLIC_PRODUCTION_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
        return `${PUBLIC_PRODUCTION_ORIGIN}${normalizedPath}`;
    }
}