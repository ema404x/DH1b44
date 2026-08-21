import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Devuelve los activos del sector del caller — la fuente para el Paso 1 de CrearOT.
//
// PROBLEMA QUE RESUELVE (sector escuela, exclusivamente)
//   CrearOT cargaba activos con base44.entities.Asset.list (RLS-applied). Para un
//   usuario con role 'user' del sector escuela, la visibilidad dependía de una
//   cláusula RLS anidada ({ $and: [ data.sector_id='escuela', role='user' ] }) que
//   no se honra de forma confiable → la lista llega vacía y el usuario no ve sus
//   activos/ubicaciones al crear una OT. Afecta a TODO role 'user' de escuela.
//
// SOLUCIÓN
//   Un endpoint read-only, service-role (bypass de RLS), sector-scoped: devuelve
//   los activos del sector del caller. El aislamiento queda garantizado por el
//   filtro sector_id = callerSector. Es puramente aditivo y SOLO lo usa CrearOT
//   cuando el sector activo es 'escuela' — bapro mantiene Asset.list sin cambios,
//   así que ningún cambio aplica a ambos sectores.
//
// PERMISO: cualquier usuario autenticado con sector puede llamarlo. Devuelve
// únicamente los activos de SU propio sector (no hay fuga cross-sector).

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });

    // Sector canónico: la ficha de Empleado es la fuente de verdad (igual que
    // getOperariosSector / eliminarOT). user.data como fallback.
    const userEmail = (user.email || '').toLowerCase().trim();
    let employee = null;
    if (userEmail) {
      const empResults = await base44.asServiceRole.entities.Employee.filter({ email: userEmail });
      employee = empResults[0] || null;
    }
    if (!employee && user.id) {
      const empByUserId = await base44.asServiceRole.entities.Employee.filter({ user_id: user.id });
      employee = empByUserId[0] || null;
    }
    const callerSector = employee?.sector_id || user.data?.sector_id || user.sector_id;
    if (!callerSector) {
      return Response.json({ error: 'Sin sector asignado' }, { status: 403 });
    }

    // Cargar activos (service role, sin RLS) y scopear al sector del caller.
    // Mismo orden (-name) que usaba CrearOT con Asset.list → comportamiento idéntico.
    const all = await base44.asServiceRole.entities.Asset.list('-name', 1000);
    const assets = all.filter((a) => a.sector_id === callerSector);

    return Response.json({
      assets,
      sector: callerSector,
      total: assets.length,
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}