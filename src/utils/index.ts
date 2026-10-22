export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

const PUBLIC_PRODUCTION_ORIGIN = 'https://dh1m.com';

/**
 * Devuelve siempre el dominio público de producción (https://dh1m.com) para QRs y links compartibles,
 * evitando que códigos QR descargados desde el editor apunten a la URL temporal de vista previa.
 */
export function getPublicAppOrigin(): string {
    if (typeof window === 'undefined') return PUBLIC_PRODUCTION_ORIGIN;
    const host = window.location.hostname.toLowerCase();
    if (host === 'dh1m.com' || host === 'www.dh1m.com') {
        return window.location.origin;
    }
    return PUBLIC_PRODUCTION_ORIGIN;
}