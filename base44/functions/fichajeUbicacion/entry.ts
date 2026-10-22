import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { resolvePublicRecordScope } from '../../shared/publicSectorScope.ts';
import { sectorErrorResponse } from '../../shared/sectorGuard.ts';
import {
  fetchAllFichajesPaginated,
  reconcileExpiredOpenFichajes,
  isExpiredOpenFichaje,
} from '../../shared/fichajeAutoCierre.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const sb = base44.asServiceRole;
    const body = await req.json();
    const { action } = body;

    // Normalizar nombre: lowercase + sin acentos + trimmed
    const normalize = (s) => (s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Normalizar DNI: solo dígitos
    const normalizeDni = (s) => (s || '').replace(/\D/g, '');

    // No aceptar entradas ni salidas sin coordenadas numéricas válidas.
    if (action === 'registrarEntrada' || action === 'registrarSalida') {
      const { latitude, longitude } = body;
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return Response.json({ error: 'Para fichar, activá la ubicación y permití el acceso al GPS en el navegador.' }, { status: 400 });
      }
    }

    const actions = ['getUbicacion', 'getJornadaAbierta', 'registrarEntrada', 'registrarSalida'];
    const scope = actions.includes(action)
      ? await resolvePublicRecordScope(base44, 'LocationQR', body.locationId)
      : null;
    const dataClient = scope?.sb || sb;

    // ── Obtener datos de la ubicación (público, sin auth) ──────────────────────
    if (action === 'getUbicacion') {
      const { locationId } = body;
      if (!locationId) return Response.json({ error: 'locationId requerido' }, { status: 400 });
      const results = await dataClient.entities.LocationQR.filter({ id: locationId });
      const list = Array.isArray(results) ? results : (results?.items || []);
      const location = list[0] || null;
      if (!location) return Response.json({ error: 'Ubicación no encontrada' }, { status: 404 });
      return Response.json({
        location: {
          id: location.id,
          name: location.name,
          address: location.address,
          latitude: location.latitude ?? null,
          longitude: location.longitude ?? null,
          is_active: location.is_active,
          color: location.color,
          sector_id: location.sector_id,
        },
      });
    }

    // ── Verificar si hay jornada abierta para un nombre/DNI + ubicación ─────────
    // Cierra primero los registros vencidos confirmando su persistencia; si falla, propaga error.
    if (action === 'getJornadaAbierta') {
      const { locationId, operarioNombre, dni } = body;
      if (!locationId || (!operarioNombre?.trim() && !dni?.trim())) {
        return Response.json({ jornada: null });
      }
      const rawOpen = await fetchAllFichajesPaginated(dataClient, {
        location_qr_id: locationId,
        estado: 'abierta',
      });
      const { activeToday: open } = await reconcileExpiredOpenFichajes(dataClient, rawOpen, new Date(), {
        throwOnFailure: true,
      });

      const dniNorm = normalizeDni(dni);
      const nameNorm = normalize(operarioNombre);

      let match = null;
      if (dniNorm) {
        match = open.find(j => !isExpiredOpenFichaje(j) && normalizeDni(j.dni) === dniNorm);
      }
      if (!match && nameNorm) {
        match = open.find(j => !isExpiredOpenFichaje(j) && normalize(j.operario_nombre) === nameNorm);
      }
      return Response.json({ jornada: match || null });
    }

    // ── Registrar entrada ──────────────────────────────────────────────────────
    if (action === 'registrarEntrada') {
      const { locationId, operarioNombre, dni, signatureBase64, latitude, longitude, accuracy } = body;
      if (!locationId || !operarioNombre?.trim()) {
        return Response.json({ error: 'Nombre y ubicación son requeridos' }, { status: 400 });
      }
      if (!dni?.trim() || normalizeDni(dni).length < 7) {
        return Response.json({ error: 'El DNI es obligatorio (mínimo 7 dígitos)' }, { status: 400 });
      }
      if (!signatureBase64) {
        return Response.json({ error: 'La firma es obligatoria' }, { status: 400 });
      }

      const nameNorm = normalize(operarioNombre);
      const dniNorm = normalizeDni(dni);

      const locResults = await dataClient.entities.LocationQR.filter({ id: locationId });
      const locList = Array.isArray(locResults) ? locResults : (locResults?.items || []);
      const location = locList[0];
      if (!location) return Response.json({ error: 'Ubicación no encontrada' }, { status: 404 });
      if (!location.is_active) {
        return Response.json({ error: 'Este punto de fichaje está desactivado' }, { status: 403 });
      }

      // Cerrar primero jornadas vencidas; si una actualización falla, lanza error y bloquea nueva entrada
      const rawOpen = await fetchAllFichajesPaginated(dataClient, {
        location_qr_id: locationId,
        estado: 'abierta',
      });
      const { activeToday: open } = await reconcileExpiredOpenFichajes(dataClient, rawOpen, new Date(), {
        throwOnFailure: true,
      });

      let existing = null;
      if (dniNorm) {
        existing = open.find(j => normalizeDni(j.dni) === dniNorm);
      }
      if (!existing) {
        existing = open.find(j => normalize(j.operario_nombre) === nameNorm);
      }
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
      const jornada = await dataClient.entities.FichajeUbicacion.create({
        location_qr_id: locationId,
        location_name: location.name,
        operario_nombre: operarioNombre.trim(),
        dni: dniNorm,
        entrada_timestamp: now,
        entrada_signature_url: sigResult.file_url,
        entrada_latitude: latitude,
        entrada_longitude: longitude,
        entrada_accuracy: Number.isFinite(accuracy) && accuracy > 0 ? Math.round(accuracy) : null,
        estado: 'abierta',
        estado_admin: 'pendiente',
        jefe_sitio_email: location.jefe_sitio_email || null,
        device_info: body.deviceInfo || '',
        sector_id: scope.sector,
      });

      return Response.json({ success: true, jornada });
    }

    // ── Registrar salida ───────────────────────────────────────────────────────
    if (action === 'registrarSalida') {
      const { locationId, operarioNombre, dni, signatureBase64, latitude, longitude, accuracy } = body;
      if (!locationId || !operarioNombre?.trim()) {
        return Response.json({ error: 'Nombre y ubicación son requeridos' }, { status: 400 });
      }
      if (!dni?.trim() || normalizeDni(dni).length < 7) {
        return Response.json({ error: 'El DNI es obligatorio (mínimo 7 dígitos)' }, { status: 400 });
      }
      if (!signatureBase64) {
        return Response.json({ error: 'La firma es obligatoria' }, { status: 400 });
      }

      const nameNorm = normalize(operarioNombre);
      const dniNorm = normalizeDni(dni);

      // Cerrar primero jornadas vencidas; si una actualización falla, lanza error y bloquea salida inválida
      const rawOpen = await fetchAllFichajesPaginated(dataClient, {
        location_qr_id: locationId,
        estado: 'abierta',
      });
      const { activeToday: open } = await reconcileExpiredOpenFichajes(dataClient, rawOpen, new Date(), {
        throwOnFailure: true,
      });

      let jornada = null;
      if (dniNorm) {
        jornada = open.find(j => !isExpiredOpenFichaje(j) && normalizeDni(j.dni) === dniNorm);
      }
      if (!jornada) {
        jornada = open.find(j => !isExpiredOpenFichaje(j) && normalize(j.operario_nombre) === nameNorm);
      }
      if (!jornada) {
        return Response.json({
          error: 'No se encontró una entrada abierta vigente para hoy en esta ubicación. Registrá tu entrada primero.',
        }, { status: 404 });
      }

      // Subir firma de salida
      const binary = Uint8Array.from(atob(signatureBase64), c => c.charCodeAt(0));
      const blob = new Blob([binary], { type: 'image/png' });
      const file = new File([blob], 'firma_salida.png', { type: 'image/png' });
      const sigResult = await sb.integrations.Core.UploadPublicFile({ file });

      const now = new Date().toISOString();
      const updated = await dataClient.entities.FichajeUbicacion.update(jornada.id, {
        salida_timestamp: now,
        salida_signature_url: sigResult.file_url,
        salida_latitude: latitude,
        salida_longitude: longitude,
        salida_accuracy: Number.isFinite(accuracy) && accuracy > 0 ? Math.round(accuracy) : null,
        estado: 'cerrada',
      });

      return Response.json({ success: true, jornada: updated });
    }

    return Response.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return sectorErrorResponse(error);
  }
}