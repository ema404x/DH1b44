import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveAndReconcileSector } from '../../shared/callerIdentity.ts';
import { fetchAll } from '../../shared/fetchAllSector.ts';
import { esOtVencida } from '../../shared/otVencimiento.ts';
import {
  resolveAdminView,
  resolveEstablecimientosDeJefe,
  filterWorkOrdersByVisibility,
  filterPendientesByVisibility,
  filterAssetsByVisibility,
} from '../../shared/visibilityResolver.ts';

/**
 * Devuelve las alertas ACTIVAS que el usuario actual debe ver — vivas, sin
 * persistir por usuario. ÚNICA fuente de display del banner de alertas.
 *
 * Visibilidad por tipo (regla: una alerta llega a un usuario solo si ese
 * usuario puede ver la entidad subyacente, respetando admin_view del Control
 * de Acceso resuelto desde Employee.role — NO platformRole):
 *  - ot_vencida:        WorkOrders visibles (filterWorkOrdersByVisibility) + esOtVencida.
 *  - pendiente_vencido: Pendientes visibles (filterPendientesByVisibility) + fecha_limite vencida.
 *  - garantia_activo:   Assets visibles (filterAssetsByVisibility) + warranty_expiry por vencer.
 *  - stock_material:    solo si admin_view('Inventory'); los materiales no tienen ownership por jefe.
 *
 * Las alertas son VIVAS: desaparecen solas cuando la OT deja de estar vencida,
 * el pendiente se resuelve, o la garantía se renueva. No hay descarte manual.
 * checkAlertas (email) sigue intacto: AlertaLog queda como auditoría/historial
 * de email, no como fuente de display.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const sb = base44.asServiceRole;

    const { sector, employee } = await resolveAndReconcileSector(sb, user);
    if (!sector) return Response.json({ error: 'Sin sector asignado' }, { status: 403 });

    const userId = user.id;
    const userEmail = (user.email || '').toLowerCase().trim();
    const displayName = employee?.full_name || user.full_name || '';
    const ahora = new Date();

    // AlertaConfig activas del sector → qué tipos evaluar + umbrales.
    const configs = await fetchAll(sb, 'AlertaConfig', { sector_id: sector, activo: true });
    const tiposActivos = new Set(configs.map((c) => c.tipo));
    const cfgOf = (tipo) => configs.find((c) => c.tipo === tipo) || {};

    const establecimientos = await resolveEstablecimientosDeJefe(sb, sector, displayName);
    const alertas = [];

    // ── 1. OTs VENCIDAS (regla de oro) ──
    if (tiposActivos.has('ot_vencida')) {
      const adminView = await resolveAdminView(sb, employee, 'WorkOrder');
      const allOTs = await fetchAll(sb, 'WorkOrder', { sector_id: sector, status: 'en_progreso' });
      const visibles = allOTs.filter((ot) => ot.archivada !== true);
      const mias = filterWorkOrdersByVisibility(visibles, userId, userEmail, displayName, establecimientos, adminView);
      for (const ot of mias) {
        if (!esOtVencida(ot, ahora)) continue;
        const dv = Math.ceil((ahora.getTime() - new Date(ot.scheduled_date + 'T00:00:00Z').getTime()) / 86400000);
        const nivel = dv >= 7 ? 'critical' : 'warning';
        alertas.push({
          tipo: 'ot_vencida',
          nivel,
          titulo: `OT vencida hace ${dv} día${dv !== 1 ? 's' : ''}`,
          mensaje: `La OT "${ot.title}" (${ot.code || ot.id}) superó su fecha programada (${ot.scheduled_date}).`,
          entidad_tipo: 'WorkOrder',
          entidad_id: ot.id,
          entidad_nombre: ot.title,
          fecha_alerta: ahora.toISOString(),
        });
      }
    }

    // ── 2. PENDIENTES VENCIDOS ──
    if (tiposActivos.has('pendiente_vencido')) {
      const adminView = await resolveAdminView(sb, employee, 'Pendientes');
      const cfg = cfgOf('pendiente_vencido');
      const diasLimite = cfg.dias_vencimiento_pendiente || 7;
      const all = await fetchAll(sb, 'Pendiente', { sector_id: sector, estado: { $in: ['pendiente', 'asignado', 'en_progreso'] } });
      const visibles = adminView ? all : filterPendientesByVisibility(all, userId, userEmail, establecimientos);
      for (const p of visibles) {
        if (!p.fecha_limite) continue;
        const diasVencidos = Math.ceil((ahora.getTime() - new Date(p.fecha_limite + 'T00:00:00Z').getTime()) / 86400000);
        if (diasVencidos < diasLimite) continue;
        const nivel = diasVencidos >= diasLimite * 2 ? 'critical' : 'warning';
        alertas.push({
          tipo: 'pendiente_vencido',
          nivel,
          titulo: `Pendiente vencido hace ${diasVencidos} días`,
          mensaje: `El pendiente "${(p.descripcion || p.establecimiento || '').substring(0, 60)}" lleva ${diasVencidos} días vencido.`,
          entidad_tipo: 'Pendiente',
          entidad_id: p.id,
          entidad_nombre: p.establecimiento || (p.descripcion || '').substring(0, 40) || p.id,
          fecha_alerta: ahora.toISOString(),
        });
      }
    }

    // ── 3. GARANTÍA DE ACTIVOS ──
    if (tiposActivos.has('garantia_activo')) {
      const adminView = await resolveAdminView(sb, employee, 'Asset');
      const cfg = cfgOf('garantia_activo');
      const diasAnticipacion = cfg.dias_anticipacion || 30;
      const all = await fetchAll(sb, 'Asset', { sector_id: sector });
      const visibles = filterAssetsByVisibility(all, displayName, establecimientos, adminView);
      for (const a of visibles) {
        if (!a.warranty_expiry) continue;
        const diasRestantes = Math.ceil((new Date(a.warranty_expiry + 'T00:00:00Z').getTime() - ahora.getTime()) / 86400000);
        if (diasRestantes > diasAnticipacion) continue;
        const nivel = diasRestantes <= 7 ? 'critical' : 'warning';
        alertas.push({
          tipo: 'garantia_activo',
          nivel,
          titulo: diasRestantes < 0
            ? `Garantía VENCIDA hace ${Math.abs(diasRestantes)} días`
            : `Garantía vence en ${diasRestantes} días`,
          mensaje: `El activo "${a.name}" tiene su garantía ${diasRestantes < 0 ? 'vencida' : 'por vencer'}.`,
          entidad_tipo: 'Asset',
          entidad_id: a.id,
          entidad_nombre: a.name,
          fecha_alerta: ahora.toISOString(),
        });
      }
    }

    // ── 4. STOCK CRÍTICO DE MATERIALES ──
    if (tiposActivos.has('stock_material')) {
      const adminView = await resolveAdminView(sb, employee, 'Inventory');
      if (adminView) {
        const cfg = cfgOf('stock_material');
        const pctExtra = cfg.umbral_stock_pct || 0;
        const all = await fetchAll(sb, 'Material', { sector_id: sector });
        for (const m of all) {
          if (!m.min_stock || m.min_stock === 0) continue;
          const umbral = m.min_stock * (1 + pctExtra / 100);
          if (m.stock > umbral) continue;
          const nivel = m.stock === 0 ? 'critical' : 'warning';
          alertas.push({
            tipo: 'stock_material',
            nivel,
            titulo: m.stock === 0 ? `Sin stock: ${m.name}` : `Stock bajo: ${m.name} (${m.stock} ${m.unit || ''})`,
            mensaje: `El material "${m.name}" tiene stock ${m.stock} (mínimo: ${m.min_stock}).`,
            entidad_tipo: 'Material',
            entidad_id: m.id,
            entidad_nombre: m.name,
            fecha_alerta: ahora.toISOString(),
          });
        }
      }
      // sin admin_view → sin alertas de stock (materiales sin ownership por jefe)
    }

    // Orden: críticas primero, luego warning, luego info
    const orden = { critical: 0, warning: 1, info: 2 };
    alertas.sort((a, b) => (orden[a.nivel] ?? 3) - (orden[b.nivel] ?? 3));

    return Response.json({ alertas, total: alertas.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}