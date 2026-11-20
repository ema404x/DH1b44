// Regla de visibilidad de Activos (pantalla Activos, selectores de CrearOT /
// ProponerOT y ficha ActivoFicha).
//
// - admin y gerente (rol de plataforma): ven todos los activos del sector.
// - Cualquier otro usuario: solo los activos cuyo jefe efectivo (ver crearResolverJefe) coincide
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

// Jefe efectivo de un activo, en este orden:
//   1. Asset.jefe_sitio si está cargado.
//   2. Jefe del colegio (LocationData), igual que Información General:
//      LocationData.jefe_sitio || Direccion(direccion_id).jefe_sitio.
//      El colegio se toma por Asset.location_id, o por name/location/sede contra
//      LocationData.establecimiento / ubic_tecnica.
//   3. Jefe de la Direccion cuyo texto coincide con name/location del activo.
export function crearResolverJefe(locationData: any[], direcciones: any[]) {
  const dirById = new Map(direcciones.map((d) => [d.id, d]));
  const dirByText = new Map();
  for (const d of direcciones) if (normAsset(d.direccion)) dirByText.set(normAsset(d.direccion), d);
  const ldById = new Map(locationData.map((l) => [l.id, l]));
  const ldByText = new Map();
  for (const l of locationData) {
    for (const k of [l.establecimiento, l.ubic_tecnica]) {
      if (normAsset(k) && !ldByText.has(normAsset(k))) ldByText.set(normAsset(k), l);
    }
  }
  const textos = (a: any) => [a?.name, a?.location, a?.sede].map(normAsset).filter(Boolean);

  return (asset: any): string => {
    if (normAsset(asset?.jefe_sitio)) return asset.jefe_sitio;
    const ld = ldById.get(asset?.location_id) || textos(asset).map((t) => ldByText.get(t)).find(Boolean);
    const jefeColegio = ld ? ld.jefe_sitio || dirById.get(ld.direccion_id)?.jefe_sitio : '';
    if (normAsset(jefeColegio)) return jefeColegio;
    const dir = textos(asset).map((t) => dirByText.get(t)).find(Boolean);
    return dir?.jefe_sitio || '';
  };
}

export function assetIsMine(
  asset: any,
  keys: { names: Set<string>; emails: Set<string> },
  jefeDe: (asset: any) => string,
): boolean {
  const jefe = normAsset(jefeDe(asset));
  if (jefe && (keys.names.has(jefe) || keys.emails.has(jefe))) return true;
  const jefeEmail = normAsset(asset?.jefe_sitio_email);
  return !!jefeEmail && keys.emails.has(jefeEmail);
}