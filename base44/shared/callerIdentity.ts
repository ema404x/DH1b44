// base44/shared/callerIdentity.ts
//
// Resolución CANÓNICA del sector del caller + reconciliación con la plataforma.
//
// PROBLEMA
//   user.data.sector_id puede quedar desfasado respecto de la ficha Employee
//   (fuente canónica de sector, por decisión del proyecto). getWorkOrdersForUser
//   y transicionEstadoOT ya reconcilian; pero getDashboardMetrics y
//   getReportesGerenciales leían solo user.data.sector_id → computaban KPIs sobre
//   el sector equivocado hasta que el usuario re-logueaba ("state drift → 403s").
//
// SOLUCIÓN
//   Un único módulo que todas las funciones backend usan para resolver el sector
//   del caller desde la ficha Employee (por email, luego por user_id) y, si difiere
//   de la plataforma, alinearlo best-effort. Idempotente y fail-safe: si la
//   escritura falla, no interrumpe la lectura.

interface CallerIdentity {
  sector: string | null;
  employee: any | null;
}

// Resuelve el sector canónico: ficha Employee primero (email → user_id), luego
// plataforma como fallback. Devuelve { sector, employee } para que el caller
// reutilice la ficha (evita un fetch duplicado en roles/permisos).
export async function resolveCallerSectorCanonical(
  sb: any,
  user: any,
): Promise<CallerIdentity> {
  const userEmail = (user?.email || '').toLowerCase().trim();
  let employee: any | null = null;

  if (userEmail) {
    try {
      const byEmail = await sb.entities.Employee.filter({ email: userEmail });
      employee =
        (byEmail || []).find(
          (e: any) => (e?.email || '').toLowerCase().trim() === userEmail,
        ) || null;
    } catch {}
  }
  if (!employee && user?.id) {
    try {
      const byUid = await sb.entities.Employee.filter({ user_id: user.id });
      employee = byUid && byUid.length > 0 ? byUid[0] : null;
    } catch {}
  }

  const sector =
    employee?.sector_id || user?.data?.sector_id || user?.sector_id || null;
  return { sector, employee };
}

// Best-effort: alinea user.data.sector_id con la ficha Employee. No interrumpe
// si la escritura falla. Así RLS y otros lectores quedan en el sector correcto
// sin pedir re-login.
export async function reconcileUserSector(
  sb: any,
  user: any,
  employee: any | null,
): Promise<void> {
  if (!employee?.sector_id || !user?.id) return;
  const platformSector = user?.data?.sector_id || user?.sector_id;
  if (platformSector && platformSector !== employee.sector_id) {
    try {
      await sb.entities.User.update(user.id, {
        sector_id: employee.sector_id,
        data: { ...(user?.data || {}), sector_id: employee.sector_id },
      });
    } catch {}
  }
}

// Atajo: resolver + reconciliar en un paso. Devuelve la identidad canónica.
export async function resolveAndReconcileSector(
  sb: any,
  user: any,
): Promise<CallerIdentity> {
  const identity = await resolveCallerSectorCanonical(sb, user);
  await reconcileUserSector(sb, user, identity.employee);
  return identity;
}