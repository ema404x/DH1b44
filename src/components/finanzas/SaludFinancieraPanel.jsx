import React, { useMemo } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import {
  Activity, Clock, Users, Hash, AlertTriangle,
} from 'lucide-react';
import { fmt } from '@/components/reportes/shared';

const AGING = [
  { key: '0-30',  label: '0–30 días',  color: '#34d399' },
  { key: '31-60', label: '31–60 días', color: '#fbbf24' },
  { key: '61-90', label: '61–90 días', color: '#fb923c' },
  { key: '90+',   label: 'Más de 90',  color: '#f87171' },
];

function bucketFor(days) {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

function HealthMetric({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}1a` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground/80 font-medium truncate">{label}</p>
        <p className="text-base font-bold text-foreground tabular-nums leading-tight">{value}</p>
      </div>
      {sub && <span className="text-[10px] text-muted-foreground shrink-0">{sub}</span>}
    </div>
  );
}

export default function SaludFinancieraPanel({ invoices, totalFacturado, cobrado }) {
  // ── Aging de cuentas a cobrar (facturas no pagadas vencidas) ──
  const aging = useMemo(() => {
    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const hoy = new Date();
    invoices
      .filter(i => i.status === 'pendiente' || i.status === 'vencida')
      .forEach(i => {
        if (!i.due_date) return;
        let dias;
        try { dias = differenceInDays(hoy, parseISO(i.due_date)); } catch { return; }
        if (dias <= 0) return; // aún no vencida
        buckets[bucketFor(dias)] += (i.total || 0);
      });
    const total = Object.values(buckets).reduce((s, v) => s + v, 0);
    return { buckets, total };
  }, [invoices]);

  // ── DSO: días promedio de cobro (payment_date - issue_date) ──
  const dso = useMemo(() => {
    const pagas = invoices.filter(i => i.status === 'pagada' && i.payment_date && i.issue_date);
    if (pagas.length === 0) return null;
    const sum = pagas.reduce((s, i) => {
      try { return s + differenceInDays(parseISO(i.payment_date), parseISO(i.issue_date)); } catch { return s; }
    }, 0);
    return Math.round(sum / pagas.length);
  }, [invoices]);

  // ── % efectivación de cobranza ──
  const pctEfect = totalFacturado > 0 ? Math.round((cobrado / totalFacturado) * 100) : 0;

  // ── Concentración del top cliente ──
  const concentracion = useMemo(() => {
    const map = {};
    invoices.forEach(i => { const k = i.client_name || 'Sin cliente'; map[k] = (map[k] || 0) + (i.total || 0); });
    const top = Object.values(map).sort((a, b) => b - a)[0] || 0;
    return totalFacturado > 0 ? Math.round((top / totalFacturado) * 100) : 0;
  }, [invoices, totalFacturado]);

  // ── Ticket promedio ──
  const ticket = invoices.length > 0 ? Math.round(totalFacturado / invoices.length) : 0;

  const maxBucket = Math.max(...Object.values(aging.buckets), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Salud financiera */}
      <div className="rounded-2xl border border-border/40 bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Salud Financiera</p>
        </div>
        <p className="text-xs text-muted-foreground mb-1">Indicadores clave de cobranza</p>
        <div className="divide-y divide-border/20">
          <HealthMetric icon={Clock} label="DSO — Días promedio de cobro" value={dso == null ? '—' : `${dso} días`} color="#60a5fa" />
          <HealthMetric icon={Activity} label="Efectivación de cobranza" value={`${pctEfect}%`} color="#34d399" />
          <HealthMetric icon={Users} label="Concentración top cliente" value={`${concentracion}%`} color="#fbbf24" />
          <HealthMetric icon={Hash} label="Ticket promedio" value={fmt(ticket)} color="#c084fc" />
        </div>
      </div>

      {/* Aging de cuentas a cobrar */}
      <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <p className="text-sm font-semibold text-foreground">Aging de Cuentas a Cobrar</p>
          </div>
          <span className="text-sm font-bold text-foreground tabular-nums">{fmt(aging.total)}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Facturas impagas agrupadas por antigüedad de vencimiento</p>

        {aging.total === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
              <Activity className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-foreground/80">Sin facturas vencidas impagas</p>
            <p className="text-xs text-muted-foreground">Cartera al día</p>
          </div>
        ) : (
          <div className="space-y-4">
            {AGING.map(b => {
              const val = aging.buckets[b.key];
              const pctW = maxBucket > 0 ? (val / maxBucket) * 100 : 0;
              const pctOfTotal = aging.total > 0 ? Math.round((val / aging.total) * 100) : 0;
              return (
                <div key={b.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: b.color }} />
                      <span className="text-foreground/80 font-medium">{b.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-[10px]">{pctOfTotal}%</span>
                      <span className="font-bold text-foreground tabular-nums">{fmt(val)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pctW}%`, background: b.color }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 mt-1 border-t border-border/30 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total vencido sin cobrar</span>
              <span className="font-bold text-amber-400 tabular-nums">{fmt(aging.total)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}