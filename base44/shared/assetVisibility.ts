// Regla de visibilidad de Activos (pantalla Activos, selectores de CrearOT /
// ProponerOT y ficha ActivoFicha).
//
// - admin y gerente (rol de plataforma): ven todos los activos del sector.
// - Cualquier otro usuario: solo los activos cuyo Asset.jefe_sitio coincide
//   (normalizado) con el nombre de su ficha Employee, con el nombre de su jefe
//   asignado (Employee.assigned_jefe_sitio, caso operario) o con su email.
//   Si el activo tiene jefe_sitio_email, también se compara contra su email.

export function normAsset(s: unknown): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function seesAllAssets(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'gerente';
}

export function assetMatchKeys(employee: any, user: any) {
  const names = new Set(
    [employee?.full_name, employee?.assigned_jefe_sitio].map(normAsset).filter(Boolean),
  );
  const emails = new Set([user?.email, employee?.email].map(normAsset).filter(Boolean));
  return { names, emails };
}

export function assetIsMine(asset: any, keys: { names: Set<string>; emails: Set<string> }): boolean {
  const jefe = normAsset(asset?.jefe_sitio);
  if (jefe && (keys.names.has(jefe) || keys.emails.has(jefe))) return true;
  const jefeEmail = normAsset(asset?.jefe_sitio_email);
  return !!jefeEmail && keys.emails.has(jefeEmail);
}