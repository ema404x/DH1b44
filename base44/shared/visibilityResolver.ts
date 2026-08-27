// base44/shared/visibilityResolver.ts
//
// Resolución centralizada de VISIBILIDAD por permiso admin_view ("Ver Todo" del
// Control de Acceso) + cruce de establecimientos asignados a un jefe de sitio.
//
// PROBLEMA
//   La RLS de InspeccionColegio / Pendiente / EquipamientoCalefaccion otorgaba
//   bypass blanket al rol de plataforma admin/gerente, ignorando el toggle
//   admin_view de RolePermission. Un jefe de sitio con rol de plataforma
//   'admin' (común en la app) veía los relevamientos/pendientes/equipos de
//   TODO el sector aunque su rol de empleado no tuviera "Ver Todo" marcado.
//
// SOLUCIÓN
//   Las funciones get*ForUser (y getDashboardMetrics) resuelven admin_view
//   desde el rol del EMPLEADO (Employee.role) — no del rol de plataforma —
//   consultando RolePermission[moduleKey].admin_view. Así un platform-admin
//   vinculado como jefe_sitio queda regido por el permiso de su ficha, igual
//   que el cliente (useCurrentUser.isSuperAdmin). Sin ficha de empleado
//   (super-admin puro) → admin_view=true implícito.
//
//   Para jefes sin admin_view, la visibilidad propia se amplía con los
//   establecimientos donde son responsables, cruzando por nombre normalizado
//   contra Direccion.jefe_sitio y Asset.jefe_sitio.

import { fetchAll } from "./fetchAllSector.ts";

/** Normaliza: lowercase, sin acentos, sin espacios extra. */
export function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Resuelve si el caller tiene visibilidad total (admin_view) para un módulo.
 *
 * FUENTE DE PERMISOS: el rol del EMPLEADO (Employee.role), no el rol de
 * plataforma. Cierra el bug donde un jefe_sitio con platformRole='admin' veía
 * todo el sector: ahora su visibilidad la rige el admin_view del rol de su
 * ficha de empleado.
 *
 * - Sin ficha de empleado (super-admin puro) → true (visibilidad total).
 * - Con ficha: lee RolePermission[moduleKey].admin_view del rol del empleado.
 *   Fail-closed: si no hay RolePermission para el rol/módulo → false.
 */
export async function resolveAdminView(
  sb: any,
  employee: any,
  moduleKey: string,
): Promise<boolean> {
  // Sin ficha de empleado → super-admin puro → visibilidad total.
  if (!employee || !employee.role) return true;
  try {
    const allRps = await sb.entities.RolePermission.list("created_date", 500);
    const rp = allRps.find((r: any) => norm(r.role_name) === norm(employee.role));
    return rp?.permissions?.[moduleKey]?.admin_view === true;
  } catch {
    return false; // fail-closed
  }
}

/**
 * Resuelve el set de establecimientos/direcciones asignados a un jefe de sitio
 * dentro de un sector, para ampliar la visibilidad propia (sin admin_view).
 * Cruza por nombre normalizado contra:
 *   - Direccion.jefe_sitio  → Direccion.direccion
 *   - Asset.jefe_sitio      → Asset.sede + Asset.location
 * Devuelve un Set de strings normalizados para matcheo inclusivo.
 */
export async function resolveEstablecimientosDeJefe(
  sb: any,
  sectorId: string,
  jefeName: string,
): Promise<Set<string>> {
  const set = new Set<string>();
  if (!jefeName) return set;
  const target = norm(jefeName);
  if (!target || !sectorId) return set;
  try {
    const [dirs, assets] = await Promise.all([
      fetchAll(sb, "Direccion", { sector_id: sectorId }),
      fetchAll(sb, "Asset", { sector_id: sectorId }),
    ]);
    (dirs || []).forEach((d: any) => {
      if (d.jefe_sitio && norm(d.jefe_sitio) === target && d.direccion) {
        set.add(norm(d.direccion));
      }
    });
    (assets || []).forEach((a: any) => {
      if (a.jefe_sitio && norm(a.jefe_sitio) === target) {
        if (a.sede) set.add(norm(a.sede));
        if (a.location) set.add(norm(a.location));
      }
    });
  } catch {}
  return set;
}

/**
 * Predicado de visibilidad de WorkOrders — espejo de la rama no-Tablet de
 * getWorkOrdersForUser. Un jefe de sitio ve las OTs donde es responsable
 * (jefe_sitio_email / jefe_sitio==name), las que creó, y las que le asignaron
 * (assigned_to / assigned_name==name). Con admin_view → todo el sector.
 *
 * NOTA de consistencia: NO se extiende por establecimientos. La OT no tiene
 * campo establecimiento canónico y el módulo Órdenes (getWorkOrdersForUser) no
 * usa ese cruce → añadirlo aquí rompería "el jefe ve N OTs vencidas en Órdenes
 * ⇒ N alertas en el banner". El set se conserva en la firma para futura
 * extensión pero hoy no filtra.
 */
export function filterWorkOrdersByVisibility(
  allOTs: any[],
  userId: string,
  userEmail: string,
  displayName: string,
  _establecimientosSet: Set<string>,
  adminView: boolean,
): any[] {
  if (adminView) return allOTs;
  return allOTs.filter((ot) =>
    (ot.created_by_id && ot.created_by_id === userId) ||
    (ot.jefe_sitio_email && ot.jefe_sitio_email.toLowerCase().trim() === userEmail) ||
    (ot.assigned_to && ot.assigned_to === userId) ||
    (displayName && norm(ot.assigned_name) === norm(displayName)) ||
    (displayName && ot.jefe_sitio && norm(ot.jefe_sitio) === norm(displayName))
  );
}

/**
 * Predicado de visibilidad de Pendientes — espejo de getPendientesForUser.
 * Visibilidad propia: las que creó, las donde es jefe_sitio (por email), y las
 * de establecimientos/sitios donde es jefe asignado. Con admin_view el caller
 * ya pasa todo el sector (no filtra).
 */
export function filterPendientesByVisibility(
  all: any[],
  userId: string,
  userEmail: string,
  establecimientosSet: Set<string>,
): any[] {
  return all.filter((p) =>
    (p.created_by_id && p.created_by_id === userId) ||
    (p.jefe_sitio_email && p.jefe_sitio_email.toLowerCase().trim() === userEmail) ||
    (p.establecimiento && establecimientosSet.has(norm(p.establecimiento))) ||
    (p.sitio && establecimientosSet.has(norm(p.sitio)))
  );
}

/**
 * Predicado de visibilidad de Assets — con admin_view → todo el sector. Sin
 * admin_view → assets cuyo jefe_sitio==user.name, o cuyos establecimientos
 * (sede/location) están a cargo del jefe.
 */
export function filterAssetsByVisibility(
  all: any[],
  displayName: string,
  establecimientosSet: Set<string>,
  adminView: boolean,
): any[] {
  if (adminView) return all;
  return all.filter((a) =>
    (displayName && a.jefe_sitio && norm(a.jefe_sitio) === norm(displayName)) ||
    (a.sede && establecimientosSet.has(norm(a.sede))) ||
    (a.location && establecimientosSet.has(norm(a.location)))
  );
}