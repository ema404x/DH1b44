import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { Layers, BadgeDollarSign, Scale } from 'lucide-react';
import { fmt, fmtM, KpiCard, ChartTip, SortableTh, useTableSort } from '@/components/reportes/shared';

export default function RentabilidadProyectos({ projects, invoices }) {
  const projectData = useMemo(() => {
    const factByProject = {};
    invoices.forEach(i => {
      const k = i.project_name;
      if (!k) return;
      if (!factByProject[k]) factByProject[k] = 0;
      factByProject[k] += (i.total || 0);
    });

    return projects
      .filter(p => p.estimated_budget > 0)
      .map(p => {
        const presupuesto = p.estimated_budget || 0;
        const facturado   = factByProject[p.name] || 0;
        const margenNeto  = presupuesto - facturado;
        const margenPct   = presupuesto > 0 ? Math.round((margenNeto / presupuesto) * 100) : 0;
        return { id: p.id, name: p.name, presupuesto, facturado, margenNeto, margenPct };
      })
      .sort((a, b) => b.presupuesto - a.presupuesto);
  }, [projects, invoices]);

  const totalPresup = projectData.reduce((s, p) => s + p.presupuesto, 0);
  const totalFac    = projectData.reduce((s, p) => s + p.facturado, 0);
  const totalMargen = projectData.reduce((s, p) => s + p.margenNeto, 0);
  const margenPct   = totalPresup > 0 ? Math.round((totalMargen / totalPresup) * 100) : 0;
  const positivas   = projectData.filter(p => p.margenNeto >= 0).length;

  const chartData = projectData.slice(0, 10).map(p => ({
    name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
    margen: p.margenNeto,
  }));

  const { sort, onSort, sorted: sortedRows } = useTableSort(projectData, 'margenNeto', 'desc');

  if (projectData.length === 0) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card py-16 text-center">
        <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Sin proyectos con presupuesto para calcular margen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── KPIs ultra concisos ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Presupuesto Total" value={fmt(totalPresup)} sub={`${projectData.length} proyectos`}           icon={Layers}      accent="primary" />
        <KpiCard label="Facturado Total"    value={fmt(totalFac)}    sub={`${totalPresup>0 ? Math.round(totalFac/totalPresup*100) : 0}% del presupuesto`} icon={BadgeDollarSign} accent="blue" />
        <KpiCard label="Margen Neto Total"  value={fmt(totalMargen)} sub={`${margenPct}% · ${positivas} obras en margen`}                                icon={Scale}      accent={totalMargen >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* ── Gráfico: margen neto por obra ──────────────────────────── */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">Margen neto por obra</p>
              <p className="text-[11px] text-muted-foreground">Saldo pendiente de facturación — Top {chartData.length}</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block"/>Margen a favor</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-400 inline-block"/>Sobrefacturado</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 32 + 20)}>
            <BarChart data={chartData} layout="vertical" barCategoryGap="18%" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 3" stroke="hsl(var(--border)/0.2)" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={140} />
              <Tooltip content={<ChartTip />} />
              <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={1} />
              <Bar dataKey="margen" name="Margen Neto" radius={[3, 3, 3, 3]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.margen >= 0 ? '#10B981' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Tabla concisa: margen por proyecto ─────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Detalle por obra</p>
          <span className="text-[10px] text-muted-foreground">ordená por columna</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/20 bg-muted/10">
                <SortableTh label="Obra"        sortKey="name"        currentSort={sort} onSort={onSort} />
                <SortableTh label="Presupuesto" sortKey="presupuesto" currentSort={sort} onSort={onSort} align="right" />
                <SortableTh label="Facturado"   sortKey="facturado"   currentSort={sort} onSort={onSort} align="right" className="hidden sm:table-cell" />
                <SortableTh label="Margen $"    sortKey="margenNeto"  currentSort={sort} onSort={onSort} align="right" />
                <SortableTh label="Margen %"    sortKey="margenPct"   currentSort={sort} onSort={onSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {sortedRows.map((p) => {
                const pos = p.margenNeto >= 0;
                return (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-foreground/85 max-w-[200px] truncate" title={p.name}>{p.name}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-foreground tabular-nums whitespace-nowrap">{fmt(p.presupuesto)}</td>
                    <td className="px-4 py-2.5 text-right text-blue-400 font-semibold tabular-nums whitespace-nowrap hidden sm:table-cell">{fmt(p.facturado)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                      {pos ? '' : '-'}{fmt(Math.abs(p.margenNeto))}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${pos ? 'bg-emerald-500/12 text-emerald-400' : 'bg-red-500/12 text-red-400'}`}>
                        {pos ? '+' : ''}{p.margenPct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border/30 bg-muted/10">
              <tr>
                <td className="px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total</td>
                <td className="px-4 py-2.5 text-right font-bold text-foreground tabular-nums">{fmt(totalPresup)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-blue-400 tabular-nums hidden sm:table-cell">{fmt(totalFac)}</td>
                <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${totalMargen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalMargen < 0 ? '-' : ''}{fmt(Math.abs(totalMargen))}
                </td>
                <td className={`px-4 py-2.5 text-right font-bold ${totalMargen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{margenPct}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}