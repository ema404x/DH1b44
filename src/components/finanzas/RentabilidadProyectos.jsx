import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import StatusBadge from '@/components/shared/StatusBadge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const fmt  = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtM = (n) => { if (!n) return '$0'; if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`; if (Math.abs(n) >= 1_000) return `$${(n/1_000).toFixed(0)}K`; return `$${n}`; };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-xl px-3 py-2.5 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1.5 truncate max-w-[180px]">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: p.fill || p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function ExecBar({ pct, color }) {
  const cls = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="h-1.5 flex-1 bg-muted/40 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${cls}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-xs font-semibold text-foreground tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function RentabilidadProyectos({ projects, invoices }) {
  const projectData = useMemo(() => {
    const invByProject = {};
    invoices.forEach(i => {
      const k = i.project_name || '';
      if (!k) return;
      if (!invByProject[k]) invByProject[k] = { cobrado: 0, total: 0 };
      invByProject[k].total   += (i.total || 0);
      invByProject[k].cobrado += i.status === 'pagada' ? (i.total || 0) : 0;
    });

    return projects
      .filter(p => p.estimated_budget > 0)
      .map(p => {
        const inv = invByProject[p.name] || { cobrado: 0, total: 0 };
        return {
          ...p,
          presupuesto:  p.estimated_budget || 0,
          ejecucion:    p.progress || 0,
          facturado:    inv.total,
          cobrado:      inv.cobrado,
          rentabilidad: p.estimated_budget > 0 ? Math.round(((p.estimated_budget - inv.total) / p.estimated_budget) * 100) : null,
        };
      })
      .sort((a, b) => b.presupuesto - a.presupuesto);
  }, [projects, invoices]);

  const chartData = projectData.slice(0, 7).map(p => ({
    name: p.name.length > 16 ? p.name.substring(0, 16) + '…' : p.name,
    Presupuesto: p.presupuesto,
    Facturado:   p.facturado,
    ejecucion:   p.ejecucion,
  }));

  const totalPresup = projectData.reduce((s, p) => s + p.presupuesto, 0);
  const totalFac    = projectData.reduce((s, p) => s + p.facturado, 0);
  const pctFac      = totalPresup > 0 ? Math.round((totalFac / totalPresup) * 100) : 0;

  return (
    <div className="space-y-6">

      {/* ── Resumen rápido ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Presupuesto Total', value: fmt(totalPresup), sub: `${projectData.length} proyectos`, color: 'text-primary' },
          { label: 'Facturado Total',   value: fmt(totalFac),    sub: `${pctFac}% del presupuesto`,     color: 'text-emerald-400' },
          { label: 'Ejecución Prom.',   value: `${projectData.length > 0 ? Math.round(projectData.reduce((s,p)=>s+p.ejecucion,0)/projectData.length) : 0}%`, sub: 'promedio de avance', color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-border/40 bg-card p-4">
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${s.color}`}>{s.label}</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Gráfico barras agrupadas ──────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-0.5">Presupuesto vs. Facturado</p>
          <p className="text-xs text-muted-foreground mb-4">Top {chartData.length} proyectos por presupuesto</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barGap={3} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Presupuesto" name="Presupuesto" fill="hsl(213,90%,55%)" radius={[3,3,0,0]} opacity={0.5} />
              <Bar dataKey="Facturado"   name="Facturado"   fill="#10B981"           radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground justify-end">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary/50 inline-block"/>Presupuesto</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"/>Facturado</span>
          </div>
        </div>
      )}

      {/* ── Tabla de proyectos ────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30">
          <p className="text-sm font-semibold text-foreground">Detalle por Proyecto</p>
          <p className="text-xs text-muted-foreground">Presupuesto, avance y rentabilidad estimada</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/20">
                <th className="text-left px-5 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Proyecto</th>
                <th className="text-left px-3 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px] hidden md:table-cell">Estado</th>
                <th className="text-right px-3 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Presupuesto</th>
                <th className="text-right px-3 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px] hidden sm:table-cell">Facturado</th>
                <th className="px-5 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">Avance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/15">
              {projectData.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-muted-foreground text-sm">Sin proyectos con presupuesto</td></tr>
              ) : projectData.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-foreground leading-tight">{p.name}</p>
                    {p.client_name && <p className="text-muted-foreground mt-0.5">{p.client_name}</p>}
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <StatusBadge value={p.status} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-bold text-foreground tabular-nums">{fmt(p.presupuesto)}</span>
                  </td>
                  <td className="px-3 py-3 text-right hidden sm:table-cell">
                    <span className={`font-semibold tabular-nums ${p.facturado > 0 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {p.facturado > 0 ? fmt(p.facturado) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3 w-40">
                    <ExecBar pct={p.ejecucion} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}