import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sb = base44.asServiceRole;
    const body = await req.json();
    const { action } = body;

    // Normalizar nombre: lowercase + sin acentos + trimmed
    const normalize = (s) => (s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // ── Obtener datos de la ubicación (público, sin auth) ──────────────────────
    if (action === 'getUbicacion') {
      const { locationId } = body;
      if (!locationId) return Response.json({ error: 'locationId requerido' }, { status: 400 });
      const results = await sb.entities.LocationQR.filter({ id: locationId }).catch(() => []);
      const location = results[0] || null;
      if (!location) return Response.json({ error: 'Ubicación no encontrada' }, { status: 404 });
      return Response.json({
        location: {
          id: location.id,
          name: location.name,
          address: location.address,
          is_active: location.is_active,
          color: location.color,
          sector_id: location.sector_id,
        },
      });
    }

    // ── Verificar si hay jornada abierta para un nombre + ubicación ───────────
    // Permite a la UI mostrar "Registrar Salida" en lugar de "Registrar Entrada".
    if (action === 'getJornadaAbierta') {
      const { locationId, operarioNombre } = body;
      if (!locationId || !operarioNombre?.trim()) {
        return Response.json({ jornada: null });
      }
      const nameNorm = normalize(operarioNombre);
      const open = await sb.entities.FichajeUbicacion.filter({
        location_qr_id: locationId,
        estado: 'abierta',
      }).catch(() => []);
      const match = open.find(j => normalize(j.operario_nombre) === nameNorm);
      return Response.json({ jornada: match || null });
    }

    // ── Registrar entrada ────────────────────────────────────────────────────
    if (action === 'registrarEntrada') {
      const { locationId, operarioNombre, signatureBase64, latitude, longitude } = body;
      if (!locationId || !operarioNombre?.trim()) {
        return Response.json({ error: 'Nombre y ubicación son requeridos' }, { status: 400 });
      }
      if (!signatureBase64) {
        return Response.json({ error: 'La firma es obligatoria' }, { status: 400 });
      }

      const nameNorm = normalize(operarioNombre);

      // Validar ubicación
      const locResults = await sb.entities.LocationQR.filter({ id: locationId }).catch(() => []);
      const location = locResults[0];
      if (!location) return Response.json({ error: 'Ubicación no encontrada' }, { status: 404 });
      if (!location.is_active) {
        return Response.json({ error: 'Este punto de fichaje está desactivado' }, { status: 403 });
      }

      // Validar que no exista una jornada abierta para la misma persona + ubicación
      const open = await sb.entities.FichajeUbicacion.filter({
        location_qr_id: locationId,
        estado: 'abierta',
      }).catch(() => []);
      const existing = open.find(j => normalize(j.operario_nombre) === nameNorm);
      if (existing) {
        return Response.json({
          error: 'Ya tenés una entrada abierta en esta ubicación. Registrá tu salida primero.',
        }, { status: 409 });
      }

      // Subir firma (service role → UploadPublicFile)
      const binary = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
      const blob = new Blob([binary], { type: 'image/png' });
      const file = new File([blob], 'firma_entrada.png', { type: 'image/png' });
      const sigResult = await sb.integrations.Core.UploadPublicFile({ file });

      const now = new Date().toISOString();
      const jornada = await sb.entities.FichajeUbicacion.create({
        location_qr_id: locationId,
        location_name: location.name,
        operario_nombre: operarioNombre.trim(),
        entrada_timestamp: now,
        entrada_signature_url: sigResult.file_url,
        entrada_latitude: latitude || null,
        entrada_longitude: longitude || null,
        estado: 'abierta',
        device_info: body.deviceInfo || navigator?.userAgent?.slice(0, 120) || '',
        sector_id: location.sector_id || null,
      });

      return Response.json({ success: true, jornada });
    }

    // ── Registrar salida ─────────────────────────────────────────────────────
    if (action === 'registrarSalida') {
      const { locationId, operarioNombre, signatureBase64, latitude, longitude } = body;
      if (!locationId || !operarioNombre?.trim()) {
        return Response.json({ error: 'Nombre y ubicación son requeridos' }, { status: 400 });
      }
      if (!signatureBase64) {
        return Response.json({ error: 'La firma es obligatoria' }, { status: 400 });
      }

      const nameNorm = normalize(operarioNombre);

      // Buscar jornada abierta para esta persona + ubicación
      const open = await sb.entities.FichajeUbicacion.filter({
        location_qr_id: locationId,
        estado: 'abierta',
      }).catch(() => []);
      const jornada = open.find(j => normalize(j.operario_nombre) === nameNorm);
      if (!jornada) {
        return Response.json({
          error: 'No se encontró una entrada abierta para este nombre en esta ubicación. Registrá tu entrada primero.',
        }, { status: 404 });
      }

      // Subir firma de salida
      const binary = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
      const blob = new Blob([binary], { type: 'image/png' });
      const file = new File([blob], 'firma_salida.png', { type: 'image/png' });
      const sigResult = await sb.integrations.Core.UploadPublicFile({ file });

      const now = new Date().toISOString();
      const updated = await sb.entities.FichajeUbicacion.update(jornada.id, {
        salida_timestamp: now,
        salida_signature_url: sigResult.file_url,
        salida_latitude: latitude || null,
        salida_longitude: longitude || null,
        estado: 'cerrada',
      });

      return Response.json({ success: true, jornada: updated });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}