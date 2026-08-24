import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Notificación masiva de anuncios del foro — premium, sectorizada, idempotente.
// Se dispara vía automation on ForoHilo create (trigger_conditions: tipo='anuncio').
//
// REGLA DE ORO: backend-first. La versión anterior notificaba desde el cliente
// (N creates desde el browser, frágil) y además a TODOS los usuarios sin respetar
// el sector del autor → fuga cross-sector. Tampoco estampaba sector_id en la
// ForoNotificacion → el RLS read (data.sector_id == user.data.sector_id) la
// ocultaba, así que el destinatario nunca la veía.
//
// Acá el backend:
//   1. Resuelve el sector del hilo (hilo.sector_id).
//   2. Arma la lista de usuarios de ESE sector (User.data.sector_id).
//   3. Crea una ForoNotificacion (tipo 'anuncio') por cada uno excepto el autor,
//      estampando sector_id — sin eso el RLS la oculta.
//   4. Idempotente: si ya existen notificaciones para el hilo, no recrea.
//
// Sin user context ( corre como automation): no usa auth.me(), solo asServiceRole.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // Payload de la entity automation: { event, data, old_data, changed_fields, payload_too_large }
    let hilo = body?.data;
    const hiloId = hilo?.id || body?.event?.entity_id;
    // Fallback: si payload_too_large, data viene null → fetch por id.
    if ((!hilo || !hilo.id) && hiloId) {
      hilo = await base44.asServiceRole.entities.ForoHilo.get(hiloId).catch(() => null);
    }
    if (!hilo || !hilo.id) {
      return Response.json({ error: 'Falta el hilo (data) o hilo_id' }, { status: 400 });
    }
    // Solo anuncios (la automation ya filtra, defensa en profundidad).
    if (hilo.tipo !== 'anuncio') {
      return Response.json({ skipped: true, reason: 'no es anuncio' });
    }
    const sectorId = hilo.sector_id;
    if (!sectorId) {
      return Response.json({ error: 'El hilo no tiene sector_id — no se puede sectorizar' }, { status: 400 });
    }

    const sb = base44.asServiceRole;

    // Idempotencia: si ya hay notificaciones para este hilo, no recrear.
    const existentes = await sb.entities.ForoNotificacion.filter({ hilo_id: hilo.id }).catch(() => []);
    if (existentes.length > 0) {
      return Response.json({ skipped: true, reason: 'ya notificado', total: existentes.length });
    }

    // Usuarios del sector del hilo (User.data.sector_id o User.sector_id).
    const allUsers = await sb.entities.User.list().catch(() => []);
    const sectorUsers = allUsers.filter(u => (u.data?.sector_id || u.sector_id) === sectorId);
    const autorId = hilo.autor_id || null;
    const actorNombre = hilo.autor_nombre || 'Anuncio';

    // Notificar a todos los del sector excepto al autor.
    const destinatarios = sectorUsers.filter(u => u.id !== autorId);
    if (destinatarios.length === 0) {
      return Response.json({ notificados: 0, sector: sectorId });
    }

    const notifs = destinatarios.map(u => ({
      usuario_id: u.id,
      tipo: 'anuncio',
      hilo_id: hilo.id,
      hilo_titulo: hilo.titulo || '',
      actor_nombre: actorNombre,
      leida: false,
      sector_id: sectorId,
    }));
    await sb.entities.ForoNotificacion.bulkCreate(notifs);

    return Response.json({ notificados: notifs.length, sector: sectorId });
  } catch (error) {
    return Response.json({ error: error.message || 'Error inesperado' }, { status: 500 });
  }
});