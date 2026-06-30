import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { Layers, TrendingUp, Scale } from 'lucide-react';
import { fmt, fmtM, KpiCard, ChartTip, SortableTh, useTableSort } from '@/components/reportes/shared';

export default function RentabilidadProyectos({ projects, certificados, obras }) {
  // ── Rentabilidad basada en ejecución real ──────────────────────────────
  // La empresa no usa facturas: el "facturado" se reemplaza por el valor
  // ejecutado = presupuesto × (% avance / 100).
  const projectData = useMemo(() => {
    return projects
      .filter(p => (p.estimated_budget || 0) > 0)
      .map(p => {
        const presupuesto = p.estimated_budget || 0;
        const progreso = p.progress || 0;
        const valorEjecutado = Math.round(presupuesto * progreso / 100);
        const saldo = presupuesto - valorEjecutado;
        const margenPct = presupuesto > 0 ? Math.round((saldo / presupuesto) * 100) : 0;
        return {
          id: p.id,
          name: p.name,
          presupuesto,
          progreso,
          valorEjecutado,
          saldo,
          margenPct,
        };
      })
      .sort((a, b) => b.presupuesto - a.presupuesto);
  }, [projects]);

  const totalPresup   = projectData.reduce((s, p) => s + p.presupuesto, 0);
  const totalEjecutado = projectData.reduce((s, p) => s + p.valorEjecutado, 0);
  const totalSaldo    = projectData.reduce((s, p) => s + p.saldo, 0);
  const ejecPct       = totalPresup > 0 ? Math.round((totalEjecutado / totalPresup) * 100) : 0;
  const completados   = projectData.filter(p => p.progreso >= 100).length;

  // ── Certificados por emprendimiento ─────────────────────────────────────
  const certPorEmprendimiento = useMemo(() => {
    const map = {};
    certificados
      .filter(c => c.estado === 'aprobado' || c.estado === 'emitido')
      .forEach(c => {
        const k = c.emprendimiento || 'Sin emprendimiento';
        if (!map[k]) map[k] = { name: k, certificado: 0, count: 0 };
        map[k].certificado += (c.subtotal || 0);
        map[k].count += 1;
      });
    return Object.values(map).sort((a, b) => b.certificado - a.certificado).slice(0, 10);
  }, [certificados]);

  const chartData = projectData.slice(0, 10).map(p => ({
    name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
    saldo: p.saldo,
  }));

  const { sort, onSort, sorted: sortedRows } = useTableSort(projectData, 'saldo', 'desc');

  if (projectData.length === 0) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card py-16 text-center">
        <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Sin proyectos con presupuesto para analizar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Presupuesto Total"   value={fmt(totalPresup)}    sub={`${projectData.length} proyectos`}                    icon={Layers}     accent="primary" />
        <KpiCard label="Valor Ejecutado"      value={fmt(totalEjecutado)} sub={`${ejecPct}% del presupuesto · ${completados} completados`} icon={TrendingUp} accent="blue" />
        <KpiCard label="Saldo por Ejecutar"   value={fmt(totalSaldo)}     sub={`${100 - ejecPct}% del presupuesto`}                icon={Scale}      accent={totalSaldo >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* ── Gráfico: saldo por ejecutar por obra ────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">Saldo por ejecutar por obra</p>
              <p className="text-[11px] text-muted-foreground">Presupuesto − valor ejecutado — Top {chartData.length}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 32 + 20)}>
            <BarChart data={chartData} layout="vertical" barCategoryGap="18%" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 3" stroke="hsl(var(--border)/0.2)" horizontal={false} />
              <XAxis type="number" tickFormatter={fmtM} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={140} />
              <Tooltip content={<ChartTip />} />
              <ReferenceLine x={0} stroke="hsl(var(--border))" strokeWidth={1} />
              <Bar dataKey="saldo" name="Saldo" radius={[3, 3, 3, 3]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.saldo >= 0 ? '#34d399' : '#f87171'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Certificados por emprendimiento ─────────────────────────────────── */}
      {certPorEmprendimiento.length > 0 && (
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <div className="mb-4">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">Certificaciones por Establecimiento</p>
            <p className="text-[11px] text-muted-foreground">Monto certificado (emitido + aprobado) — Top {certPorEmprendimiento.length}</p>
          </div>
          <div className="space-y-2.5">
            {certPorEmprendimiento.map((c, i) => {
              const max = certPorEmprendimiento[0]?.certificado || 1;
              return (
                <div key={c.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground/40 font-mono text-[10px] w-3 shrink-0">{i + 1}</span>
                      <span className="text-foreground/85 truncate font-medium" title={c.name}>{c.name}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full shrink-0">{c.count} cert.</span>
                    </div>
                    <span className="font-bold text-foreground shrink-0 ml-2 tabular-nums">{fmt(c.certificado)}</span>
                  </div>
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(c.certificado / max) * 100}%`, background: `hsl(213,90%,${55 - i * 4}%)` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tabla: detalle por obra ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Detalle por obra</p>
          <span className="text-[10px] text-muted-foreground">ordená por columna</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/20 bg-muted/10">
                <SortableTh label="Obra"            sortKey="name"           currentSort={sort} onSort={onSort} />
                <SortableTh label="Presupuesto"     sortKey="presupuesto"    currentSort={sort} onSort={onSort} align="right" />
                <SortableTh label="% Ejec."          sortKey="progreso"       currentSort={sort} onSort={onSort} align="right" />
                <SortableTh label="Valor Ejecutado" sortKey="valorEjecutado" currentSort={sort} onSort={onSort} align="right" className="hidden sm:table-cell" />
                <SortableTh label="Saldo"           sortKey="saldo"          currentSort={sort} onSort={onSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {sortedRows.map((p) => (
                <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5 font-semibold text-foreground/85 max-w-[200px] truncate" title={p.name}>{p.name}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-foreground tabular-nums whitespace-nowrap">{fmt(p.presupuesto)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      p.progreso >= 100 ? 'bg-emerald-500/12 text-emerald-400' :
                      p.progreso >= 50  ? 'bg-blue-500/12 text-blue-400' :
                                          'bg-amber-500/12 text-amber-400'
                    }`}>
                      {p.progreso}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-blue-400 font-semibold tabular-nums whitespace-nowrap hidden sm:table-cell">{fmt(p.valorEjecutado)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap ${p.saldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(p.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border/30 bg-muted/10">
              <tr>
                <td className="px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total</td>
                <td className="px-4 py-2.5 text-right font-bold text-foreground tabular-nums">{fmt(totalPresup)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-foreground">{ejecPct}%</td>
                <td className="px-4 py-2.5 text-right font-bold text-blue-400 tabular-nums hidden sm:table-cell">{fmt(totalEjecutado)}</td>
                <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${totalSaldo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(totalSaldo)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}