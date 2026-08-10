import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Reconciliación robusta OT ↔ LocationQR.
// Objetivo: que cuando se escanea un QR de ubicación aparezcan TODAS las OT
// generadas en esa ubicación. Para eso, cada OT debe tener location_qr_id válido
// apuntando al QR correcto.
//
// Repara dos problemas detectados en la auditoría:
//  1. OTs con location_qr_id COLGANTE (apunta a un QR que ya no existe).
//  2. OTs SIN location_qr_id (generadas sin vincular a ubicación).
// En ambos casos re-vincula la OT al QR correcto buscando coincidencia por
// nombre de ubicación, dirección o proyecto. Así el escaneo resuelve todas
// las OTs de cada QR.
//
// Invocación:
//   payload { dry_run: true }  → solo reporta, no escribe
//   payload { dry_run: false } → aplica los cambios

const norm = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (user.role !== 'admin')
      return Response.json({ error: 'Solo admin puede ejecutar reconciliación' }, { status: 403 });

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = !!body?.dry_run;
    } catch {
      dryRun = false;
    }

    // Cargar OTs y QRs completos (service role, sin RLS)
    const [ots, qrs] = await Promise.all([
      base44.asServiceRole.entities.WorkOrder.list('created_date', 5000),
      base44.asServiceRole.entities.LocationQR.list('name', 5000),
    ]);

    const qrById = new Map(qrs.map((q) => [q.id, q]));
    const qrByName = new Map();
    const qrByAddress = new Map();
    for (const q of qrs) {
      if (q.name) qrByName.set(norm(q.name), q);
      if (q.address) qrByAddress.set(norm(q.address), q);
    }

    // Busca el QR correcto para una OT, en orden de precisión descendente.
    const matchQR = (ot) => {
      // 1) location_qr_name exacto normalizado
      if (ot.location_qr_name) {
        const m = qrByName.get(norm(ot.location_qr_name));
        if (m) return m;
      }
      // 2) Por location (texto) == nombre del QR
      if (ot.location) {
        const loc = norm(ot.location);
        let m = qrByName.get(loc);
        if (m) return m;
        // location suele venir como "DIRECCIÓN, CABA" → matchear por address
        m = qrByAddress.get(loc);
        if (m) return m;
        // Coincidencia por substring (location contiene el nombre/dirección del QR)
        for (const [name, q] of qrByName) {
          if (name.length > 4 && loc.includes(name)) return q;
        }
        for (const [addr, q] of qrByAddress) {
          if (addr.length > 4 && loc.includes(addr)) return q;
        }
      }
      // 3) Por project_id: si hay un único QR del mismo proyecto, vincularlo;
      //    si hay varios, desambiguar por coincidencia de location vs name
      if (ot.project_id) {
        const cands = qrs.filter((q) => q.project_id && q.project_id === ot.project_id);
        if (cands.length === 1) return cands[0];
        if (cands.length > 1 && ot.location) {
          const loc = norm(ot.location);
          const sub = cands.find(
            (q) =>
              (norm(q.name).length > 4 && loc.includes(norm(q.name))) ||
              (norm(q.name).length > 4 && norm(q.name).includes(loc))
          );
          if (sub) return sub;
        }
      }
      return null;
    };

    // OTs a reparar: location_qr_id faltante O colgante (QR inexistente)
    const toFix = [];
    for (const ot of ots) {
      const hasValidQR = ot.location_qr_id && qrById.has(ot.location_qr_id);
      if (hasValidQR) continue;
      const qr = matchQR(ot);
      if (qr) toFix.push({ ot, qr });
    }

    let fixed = 0;
    const errors = [];
    if (!dryRun) {
      const BATCH = 20;
      for (let i = 0; i < toFix.length; i += BATCH) {
        const batch = toFix.slice(i, i + BATCH);
        await Promise.allSettled(
          batch.map(async ({ ot, qr }) => {
            try {
              await base44.asServiceRole.entities.WorkOrder.update(ot.id, {
                location_qr_id: qr.id,
                location_qr_name: qr.name,
              });
              fixed++;
            } catch (e) {
              errors.push({ id: ot.id, error: e.message });
            }
          })
        );
      }
    } else {
      fixed = toFix.length;
    }

    // QRs con OT vinculada (ya válidos + los que se acaban de revincular)
    const linkedIds = new Set();
    for (const ot of ots) {
      if (ot.location_qr_id && qrById.has(ot.location_qr_id)) linkedIds.add(ot.location_qr_id);
    }
    for (const { qr } of toFix) linkedIds.add(qr.id);

    const orphanQRs = qrs.filter((q) => !linkedIds.has(q.id));

    return Response.json({
      success: true,
      dry_run: dryRun,
      resumen: {
        ots_total: ots.length,
        qrs_total: qrs.length,
        ots_a_revincular: toFix.length,
        ots_revinculadas: fixed,
        errores: errors.length,
        qrs_con_ot: qrs.length - orphanQRs.length,
        qrs_sin_ot_tras_reconciliacion: orphanQRs.length,
      },
      muestra_revinculados: toFix.slice(0, 8).map(({ ot, qr }) => ({
        ot_id: ot.id.slice(-6),
        title: ot.title,
        location: ot.location,
        qr_name: qr.name,
      })),
      qrs_sin_ot_muestra: orphanQRs.slice(0, 12).map((q) => ({
        name: q.name,
        project: q.project_name,
        scans: q.total_scans,
      })),
      errores_detalle: errors.slice(0, 5),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}