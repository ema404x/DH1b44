import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isFieldRole } from "../../shared/roles.ts";

/**
 * Devuelve las OTs que el usuario actual puede ver.
 * Es la ÚNICA fuente de verdad para visibilidad de OTs — centraliza toda la lógica
 * de filtrado en el backend, sin depender de RLS ni de filtros frontend.
 *
 * Reglas:
 * - Admin / Gerente: ve todas las OTs de su sector.
 * - Jefe de sitio / campo: ve OTs donde es creador, jefe_sitio_email, assigned_to,
 *   o donde su nombre aparece en jefe_sitio / assigned_name.
 */
// Paginación completa de las OTs de un sector (sin cap). Para admins/gerente
// con admin_view: el total debe ser exacto sin importar el volumen — antes el
// cap de 900 subreportaba totales en sectores grandes. Pagina por created_date
// (cursor estable, a diferencia de updated_date que muta) y reordena en memoria
// por -updated_date para preservar el burbujeo de OTs recién tocadas.
async function fetchAllSectorOTs(sb, sectorId) {
  const all = [];
  let cursor;
  let prev;
  for (let i = 0; i < 200; i++) {
    const q = { sector_id: sectorId };
    if (cursor) q.created_date = { $lt: cursor };
    let batch;
    try { batch = await sb.entities.WorkOrder.filter(q, '-created_date', 500); }
    catch { break; }
    all.push(...batch);
    if (batch.length < 500) break;
    cursor = batch[batch.length - 1]?.created_date;
    if (!cursor || cursor === prev) break;
    prev = cursor;
  }
  all.sort((a, b) => new Date(b.updated_date || 0).getTime() - new Date(a.updated_date || 0).getTime());
  return all;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const userEmail = (user.email || '').toLowerCase().trim();
    const userId = user.id;
    const platformRole = user.role;

    // Resolver empleado vinculado ANTES de calcular el sector: la ficha de
    // Empleado es la fuente canónica de sector (decisión del proyecto). Si el
    // usuario de plataforma quedó con un data.sector_id stale (ej. asignado
    // antes de existir cambiarSectorActivo), usar el sector de la ficha evita
    // que la función devuelva OTs de otro sector.
    let employee = null;
    if (userEmail) {
      const empResults = await base44.asServiceRole.entities.Employee.filter({ email: userEmail });
      employee = empResults[0] || null;
    }
    if (!employee && userId) {
      const empByUserId = await base44.asServiceRole.entities.Employee.filter({ user_id: userId });
      employee = empByUserId[0] || null;
    }

    const userSector = employee?.sector_id || user.data?.sector_id || user.sector_id;
    if (!userSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    // Reconciliación best-effort: si la ficha tiene sector y difiere del
    // usuario de plataforma, alinear data.sector_id (canónico para RLS) y el
    // top-level sector_id (legacy) al sector de la ficha. Idempotente y no
    // interrumpe el flujo si la escritura falla. Así Dashboard/Reportes/RLS
    // también quedan en el sector correcto sin pedirle al usuario que re-logee.
    try {
      if (employee?.sector_id) {
        const platformSector = user.data?.sector_id || user.sector_id;
        if (platformSector && platformSector !== employee.sector_id) {
          await base44.asServiceRole.entities.User.update(userId, {
            sector_id: employee.sector_id,
            data: { ...user.data, sector_id: employee.sector_id },
          });
        }
      }
    } catch (_) {}

    const employeeRole = (employee?.role || '').toLowerCase().trim();
    const employeeName = employee?.full_name || user.full_name || '';

    // Verificar permiso admin_view para WorkOrder (configurado en Control de Acceso).
    // admin_view (Ver Todo) es la ÚNICA llave — además de platformRole === 'admin' —
    // para que gerente/gerencia/administrativo vean todas las OTs del sector. Antes
    // se sumaban heurísticas (platformRole === 'gerente' + isAdminLevelRole) que
    // volvían redundante al checkbox "Ver Todo": esos roles veían todo igual aunque
    // estuviera desmarcado. Ahora el permiso explícito gobierna la visibilidad total.
    let hasAdminView = false;
    if (employee?.role) {
      const rolePerms = await base44.asServiceRole.entities.RolePermission.filter({});
      const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const match = rolePerms.find(rp => norm(rp.role_name) === norm(employee.role));
      hasAdminView = match?.permissions?.WorkOrder?.admin_view === true;
    }

    // Visibilidad total del sector: solo platformRole === 'admin' (cambia de
    // sector explícitamente) o el permiso explícito admin_view (Ver Todo).
    // Sin heurísticas de rol hardcodeadas — el Control de Acceso es la única fuente.
    const isAdminLevel = platformRole === 'admin' || hasAdminView;
    const isField = isFieldRole(employeeRole);

    // Query WorkOrders via service role (bypassing RLS).
    // Orden por -updated_date (no -created_date): cuando un operario inicia una OT
    // vieja encontrada por QR, la actualización (status→en_progreso, assigned_to=user.id)
    // bumpa updated_date → la OT burbujea al top-500 y queda visible en "En Progreso".
    // Con -created_date la OT vieja queda fuera del top-500 y "se sale todo" al iniciar.
    // Filtrar por sector server-side: el cap de 500 aplica SOLO al sector del caller,
    // no al pool global. Antes, si otro sector tenía >500 OTs más recientes, las del
    // caller quedaban fuera del top-500 y se subreportaban ("se sale todo").
    // Admin/gerente con admin_view: sin cap — pagina todas las OTs del sector
    // para que el total sea exacto sin importar el volumen. Roles de campo: cap
    // 900 (su subset se filtra client-side; las recién tocadas bubblan arriba).
    let allOTs;
    if (isAdminLevel) {
      allOTs = await fetchAllSectorOTs(base44.asServiceRole, userSector);
    } else {
      allOTs = await base44.asServiceRole.entities.WorkOrder.filter({ sector_id: userSector }, '-updated_date', 900);
    }

    // Filtro 1: sector (aislamiento entre sectores)
    let result = allOTs.filter(ot => (ot.sector_id || 'escuela') === userSector);

    // Filtro 2: admin/gerente ven todas las OTs de su sector.
    if (isAdminLevel) {
      return Response.json({ orders: result, total: result.length, role: 'admin' });
    }

    // Roles de campo: solo las OTs asignadas a ellos, las que crearon, o las que
    // tienen su email como jefe_sitio. NO ven todas las del sector — el descubrimiento
    // de OTs nuevas se hace escaneando el QR de la ubicación (LocationOTListModal →
    // publicFichar.getWorkOrderForLocation), y al iniciar la OT el backend estampa
    // assigned_to = user.id para que pase a estar visible acá.
    //
    // ADEMÁS match por nombre: el jefe suele asignar la OT tipeando el nombre del
    // operario en el panel de detalle (WorkOrderDetailPanel), lo que setea
    // assigned_name pero VACÍA assigned_to. Sin este match por nombre, el operario
    // no vería esas OTs en su lista proactivamente (solo las encontraría escaneando
    // el QR). Comparamos con normalización (lowercase, sin acentos) para tolerar
    // diferencias de mayúsculas/acentos entre el nombre del Employee y lo que tipeó
    // el jefe.
    if (isField) {
      const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const myName = normName(employeeName);

      // Resolver el jefe de sitio del operario. El operario de campo ejecuta el
      // trabajo que le solicita su jefe de sitio: debe ver TODAS las OTs que ese
      // jefe crea (incluso las que aún no se le asignaron nominalmente). El linkage
      // canónico es la entidad Tablet (nombre de la tablet → jefe_sitio), que es
      // como se vincula la tablet del jefe con su cuadrilla. Fallback:
      // Employee.assigned_jefe_sitio. El jefe se resuelve dentro del MISMO sector
      // (aislamiento entre sectores) — si no hay tablet/jefe configurado, no se
      // suma nada (comportamiento previo intacto, ej. sector BAPRO sin tablets).
      let jefeUserId: string | null = null;
      let jefeEmail = '';
      let jefeName = '';
      try {
        let jefeNameStr = '';
        if (employeeName) {
          const tablets = await base44.asServiceRole.entities.Tablet.filter({
            sector_id: userSector,
            nombre: employeeName,
          });
          const tablet = tablets.find(t => normName(t.nombre) === normName(employeeName));
          if (tablet?.jefe_sitio) jefeNameStr = tablet.jefe_sitio;
        }
        if (!jefeNameStr && employee?.assigned_jefe_sitio) {
          jefeNameStr = employee.assigned_jefe_sitio;
        }
        if (jefeNameStr) {
          const jefeEmps = await base44.asServiceRole.entities.Employee.filter({
            sector_id: userSector,
            full_name: jefeNameStr,
          });
          const jefe = jefeEmps.find(e => normName(e.full_name) === normName(jefeNameStr)) || null;
          if (jefe) {
            jefeUserId = jefe.user_id || null;
            jefeEmail = (jefe.email || '').toLowerCase().trim();
            jefeName = jefe.full_name || jefeNameStr;
          } else {
            jefeName = jefeNameStr;
          }
        }
      } catch (_) {}

      result = result.filter(ot =>
        (ot.assigned_to && ot.assigned_to === userId) ||
        (ot.created_by_id && ot.created_by_id === userId) ||
        (ot.jefe_sitio_email && ot.jefe_sitio_email.toLowerCase().trim() === userEmail) ||
        (myName && normName(ot.assigned_name) === myName) ||
        // OTs creadas por el jefe de sitio del operario
        (jefeUserId && ot.created_by_id && ot.created_by_id === jefeUserId) ||
        (jefeEmail && ot.jefe_sitio_email && ot.jefe_sitio_email.toLowerCase().trim() === jefeEmail) ||
        (jefeName && normName(ot.jefe_sitio) === normName(jefeName))
      );
      return Response.json({ orders: result, total: result.length, role: employeeRole });
    }

    // Sin rol de campo ni admin — ver las que creó o las que le asignaron
    // (mismo match por nombre por la misma razón: assigned_to suele quedar vacío).
    {
      const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const myName = normName(employeeName);
      result = result.filter(ot =>
        ot.created_by_id === userId ||
        (ot.assigned_to && ot.assigned_to === userId) ||
        (myName && normName(ot.assigned_name) === myName)
      );
      return Response.json({ orders: result, total: result.length, role: 'user' });
    }
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}