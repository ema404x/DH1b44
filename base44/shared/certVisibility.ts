// Resolución de propiedad de certificados — fuente única de verdad compartida
// por getCertificadosForUser (listado) y gestionarCertificados (get individual).
//
// REGLA DE ORO: backend-first cuando el RLS no resuelve de forma confiable
// quién es el dueño de cada registro.
//
// PROBLEMA
//   Los certs creados vía service role (emitirCertificado,
//   generateMonthlyCertificates) tienen created_by_id = "service_..." (no es
//   un usuario humano) y creado_por_email puede faltar (versiones previas del
//   emisor no lo estampaban). El dueño real —el jefe que generó/firmó el
//   cert— solo figura en la SolicitudCertificado vinculada
//   (campo jefe_sitio_email). Sin esta resolución, el creador real no puede
//   ver su propio certificado (caso Gastón Massa / CERT-3AA160): el RLS y los
//   backends que solo chequean created_by_id lo bloquean con 403.
//
// MODELO DE PROPIEDAD
//   Un cert es visible para un usuario no-admin si se cumple ALGUNA:
//     * created_by_id == user.id            (creado vía frontend/borrador)
//     * creado_por_email == user.email      (creado vía emitirCertificado)
//     * aprobado_por_email == user.email     (aprobado por él)
//     * existe SolicitudCertificado vinculada con jefe_sitio_email == user.email
//       (certs de service-role cuyo dueño real solo está en la solicitud)
//   Admin (user.role === 'admin') ve todo dentro de su sector (oversight).
//   Sector match estricto y fail-closed en todos los casos.
//
//   Nota: gerentes/aprobadores se resuelven fuera de este helper (en cada
//   backend con su propia regla isGerencia) porque necesitan ver todos los
//   certs de su sector para aprobar — la restricción "solo los propios"
//   aplica a jefes/users, no a aprobadores.

export interface CertLike {
  id?: string;
  sector_id?: string;
  created_by_id?: string;
  creado_por_email?: string;
  aprobado_por_email?: string;
}

export interface UserLike {
  id: string;
  email?: string;
  role?: string;
}

export interface SolicitudLike {
  certificado_id?: string;
  jefe_sitio_email?: string;
}

/**
 * ¿El cert es visible para el usuario?
 *
 * @param cert                 El certificado a evaluar.
 * @param user                 El usuario autenticado (de base44.auth.me()).
 * @param callerSector         Sector canónico del caller (fail-closed).
 * @param solicitudesForCert   Solicitudes vinculadas a este cert (puede ser []).
 *                             Se obtienen filtrando por certificado_id.
 */
export function certVisibleToUser(
  cert: CertLike,
  user: UserLike,
  callerSector: string,
  solicitudesForCert: SolicitudLike[] = []
): boolean {
  // Sector match estricto — sin bypass por rol (fail-closed).
  if (!cert.sector_id || cert.sector_id !== callerSector) return false;
  // Admin: oversight de todo su sector.
  if (user.role === 'admin') return true;

  const userEmail = (user.email || '').toLowerCase().trim();
  // Creador directo (frontend/borrador — created_by_id es un usuario real).
  if (cert.created_by_id && cert.created_by_id === user.id) return true;
  // Creador vía emitirCertificado (service role estampa creado_por_email).
  if (userEmail && (cert.creado_por_email || '').toLowerCase() === userEmail) return true;
  // Aprobador.
  if (userEmail && (cert.aprobado_por_email || '').toLowerCase() === userEmail) return true;
  // Dueño real vía solicitud vinculada (jefe_sitio_email) — caso Gastón Massa:
  // certs de service-role cuyo creador real solo está en la solicitud.
  if (userEmail && solicitudesForCert.some(
    s => (s.jefe_sitio_email || '').toLowerCase() === userEmail
  )) return true;

  return false;
}