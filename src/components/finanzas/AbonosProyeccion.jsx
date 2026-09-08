import React, { useMemo } from 'react';
import { AlertTriangle, CalendarClock, TrendingUp } from 'lucide-react';
import { fmt } from '@/components/reportes/shared';
import { mesesEntre, diasHasta } from '@/components/finanzas/abonoNeto';

// Proyección de ingresos futuros por contrato de abono activo.
// Muestra meses pendientes, monto proyectado y alertas de vencimiento/gaps.
export default function AbonosProyeccion({ abonos }) {
  const { items, totalPendiente, totalRecurrente, proximosVencer, conGaps } = useMemo(() => {
    const activos = (abonos || []).filter((a) => a.estado === 'activo');
    const now = new Date();
    const rows = activos.map((a) => {
      const montoMensual = Number(a.monto_mensual) || 0;
      const mesesFaltan = a.fecha_fin_validez ? mesesEntre(formatYM(now), a.fecha_fin_validez) : 0;
      const diasVenc = diasHasta(a.fecha_fin_validez);
      const montoPendiente = montoMensual * Math.max(0, mesesFaltan);
      return { a, montoMensual, mesesFaltan, diasVenc, montoPendiente };
    }).filter((r) => r.mesesFaltan > 0 || r.montoPendiente > 0);

    const _totalPendiente = rows.reduce((s, r) => s + r.montoPendiente, 0);
    const _totalRecurrente = rows.reduce((s, r) => s + r.montoMensual, 0);
    const _proximosVencer = rows.filter((r) => r.diasVenc != null && r.diasVenc >= 0 && r.diasVenc <= 60).length;
    // Gaps: meses transcurridos del contrato > certificados_emitidos
    const _conGaps = rows.filter((r) => {
      const transcurridos = r.a.fecha_inicio_validez ? mesesEntre(r.a.fecha_inicio_validez, formatYM(now)) : 0;
      const emitidos = Number(r.a.certificados_emitidos) || 0;
      return transcurridos > emitidos;
    }).length;

    return { items: rows, totalPendiente: _totalPendiente, totalRecurrente: _totalRecurrente, proximosVencer: _proximosVencer, conGaps: _conGaps };
  }, [abonos]);

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-foreground">Próximos Meses a Certificar</p>
            <p className="text-xs text-muted-foreground">Ingreso recurrente pendiente por contrato activo</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-amber-400">{fmt(totalPendiente)}</p>
          <p className="text-[10px] text-muted-foreground">Pendiente proyectado</p>
        </div>
      </div>

      {/* Alertas resumen */}
      <div className="flex flex-wrap gap-2 mb-4">
        <AlertBadge icon={TrendingUp} color="emerald" label={`${fmt(totalRecurrente)} recurrente / mes`} />
        {proximosVencer > 0 && <AlertBadge icon={AlertTriangle} color="amber" label={`${proximosVencer} vencen en 60 días`} />}
        {conGaps > 0 && <AlertBadge icon={AlertTriangle} color="red" label={`${conGaps} con meses sin certificar`} />}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No hay contratos de abono activos</p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => {
            const transcurridos = r.a.fecha_inicio_validez ? mesesEntre(r.a.fecha_inicio_validez, formatYM(new Date())) : 0;
            const emitidos = Number(r.a.certificados_emitidos) || 0;
            const tieneGap = transcurridos > emitidos;
            const vencePronto = r.diasVenc != null && r.diasVenc >= 0 && r.diasVenc <= 60;
            return (
              <div key={r.a.id} className="flex items-center justify-between gap-3 py-2.5 border-b border-border/20 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{r.a.contratista || r.a.emprendimiento || 'Sin nombre'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {r.mesesFaltan} meses pendientes · {r.a.fecha_fin_validez ? `vence ${r.a.fecha_fin_validez}` : 'sin fin de vigencia'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tieneGap && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/12 text-red-400">Gap: {transcurridos - emitidos}m</span>}
                  {vencePronto && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/12 text-amber-400">Vence</span>}
                  <span className="text-sm font-bold tabular-nums text-foreground">{fmt(r.montoPendiente)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertBadge({ icon: Icon, color, label }) {
  const cls = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
    red: 'bg-red-500/10 text-red-400',
  }[color] || 'bg-muted/30 text-muted-foreground';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />{label}
    </span>
  );
}

function formatYM(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}