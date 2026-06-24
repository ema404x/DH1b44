import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CircleCheck, BadgeDollarSign, Scale, CircleAlert } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { fmt, fmtM, pct, ChartTip, KpiCard, KpiSkeleton, TableSkeleton, SortableTh, useTableSort } from '@/components/reportes/shared';

const ESTADO_CFG = {
  listo_certificar: { label: 'Listo',       cls: 'bg-emerald-500/12 text-emerald-400' },
  pendiente:        { label: 'Pendiente',    cls: 'bg-red-500/12 text-red-400'         },
  observado:        { label: 'Observado',    cls: 'bg-slate-500/12 text-slate-400'     },
  faltan_actas:     { label: 'Faltan actas', cls: 'bg-amber-500/12 text-amber-400'     },
  falta_aprobar_mein: { label: 'Falta MEIN', cls: 'bg-orange-500/12 text-orange-400'  },
};

export default function ReporteMensualComparativo() {
  const [mes,           setMes]           = useState(format(new Date(), 'yyyy-MM'));
  const [filtroEstado,  setFiltroEstado]  = useState('todos');

  const { data: certificados = [], isLoading: loadingC } = useQuery({ queryKey: ['certificados-list'], queryFn: () => base44.entities.Certificado.list('-fecha_certificado', 500),  staleTime: 2*60*1000 });
  const { data: facturas = [],     isLoading: loadingF } = useQuery({ queryKey: ['invoices-list'],   queryFn: () => base44.entities.Invoice.list('-issue_date', 500),              staleTime: 2*60*1000 });
  const { data: obras = [],        isLoading: loadingO } = useQuery({ queryKey: ['obras-certif-rep'],queryFn: () => base44.entities.ObraCertificacion.list('-created_date', 500),  staleTime: 2*60*1000 });
  const loading = loadingC || loadingF || loadingO;

  const mesesDisponibles = useMemo(() => {
    const list = [];
    for (let i = 11; i >= 0; i--) {
      const f = subMonths(new Date(), i);
      const val = format(f, 'yyyy-MM');
      const label = format(f, 'MMMM yyyy', { locale: es });
      list.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return list;
  }, []);

  const certsMes = useMemo(() =>
    certificados.filter(c => c.fecha_certificado && c.estado === 'aprobado' && format(new Date(c.fecha_certificado), 'yyyy-MM') === mes),
  [certificados, mes]);

  const facsMes = useMemo(() =>
    facturas.filter(f => f.issue_date && format(new Date(f.issue_date), 'yyyy-MM') === mes),
  [facturas, mes]);

  // Tabla por obra — cruza certs + facturas + obras
  const rows = useMemo(() => {
    const map = new Map();
    certsMes.forEach(c => {
      const k = c.obra_servicio || c.ada_numero || 'Sin especificar';
      if (!map.has(k)) map.set(k, { obra: k, certificado: 0, facturado: 0, cQty: 0, fQty: 0, estado_cobro: 'pendiente', avance: 0 });
      const r = map.get(k); r.certificado += c.subtotal || 0; r.cQty++;
    });
    facsMes.forEach(f => {
      const k = f.project_name || 'Sin especificar';
      if (!map.has(k)) map.set(k, { obra: k, certificado: 0, facturado: 0, cQty: 0, fQty: 0, estado_cobro: 'pendiente', avance: 0 });
      const r = map.get(k); r.facturado += f.total || 0; r.fQty++;
    });
    obras.forEach(o => {
      if (map.has(o.titulo)) {
        const r = map.get(o.titulo);
        r.estado_cobro = o.estado_cobro; r.avance = o.porcentaje_avance || 0;
      }
    });
    let list = Array.from(map.values()).map(r => ({ ...r, diferencia: r.certificado - r.facturado, compliance: r.certificado > 0 ? Math.round((r.facturado / r.certificado) * 100) : 0 }));
    if (filtroEstado !== 'todos') list = list.filter(r => r.estado_cobro === filtroEstado);
    return list;
  }, [certsMes, facsMes, obras, filtroEstado]);

  const totalCert = rows.reduce((s, r) => s + r.certificado, 0);
  const totalFac  = rows.reduce((s, r) => s + r.facturado, 0);
  const diff      = totalCert - totalFac;
  const obrasOk   = rows.filter(r => Math.abs(r.diferencia) < 1).length;

  const chartData = rows.slice(0, 8).map(r => ({
    name: r.obra.length > 14 ? r.obra.slice(0, 14) + '…' : r.obra,
    Certificado: r.certificado,
    Facturado:   r.facturado,
  }));

  const { sort, onSort, sorted: sortedRows } = useTableSort(rows, 'certificado', 'desc');

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{mesesDisponibles.map(m => <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estados</SelectItem>
            {Object.entries(ESTADO_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {loading
          ? <span className="text-[10px] text-muted-foreground ml-1">cargando…</span>
          : <span className="text-[10px] text-muted-foreground ml-1">{rows.length} obras · {certsMes.length} certificados · {facsMes.length} facturas</span>}
      </div>

      {loading ? (
        <div className="space-y-5">
          <KpiSkeleton />
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card py-16 text-center">
          <CircleAlert className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Sin datos para el período / filtro seleccionado.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Probá con otro mes o estado de cobro.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Certificado"      value={fmt(totalCert)}           sub={`${certsMes.length} certificados`}                              icon={CircleCheck}   accent="emerald" />
            <KpiCard label="Facturado"        value={fmt(totalFac)}            sub={`${facsMes.length} facturas`}                                     icon={BadgeDollarSign} accent="blue"   />
            <KpiCard label={diff >= 0 ? 'Saldo a favor' : 'Saldo en contra'} value={fmt(Math.abs(diff))} sub={diff > 0 ? 'Certificación adelantada' : diff < 0 ? 'Facturación adelantada' : 'Balanceado'} icon={Scale} accent={diff >= 0 ? 'emerald' : 'red'} />
            <KpiCard label="Obras alineadas"  value={obrasOk} sub={`de ${rows.length} · ${pct(obrasOk/Math.max(rows.length,1)*100)} concordancia`} icon={CircleAlert} accent="purple" />
          </div>

          {/* Gráfico + Tabla lado a lado en desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Gráfico */}
            {chartData.length > 0 && (
              <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-bold text-foreground uppercase tracking-wide">Top obras — Comparativa</p>
                    <p className="text-[11px] text-muted-foreground">Cert. vs Facturado</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="2 3" stroke="hsl(var(--border)/0.25)" vertical={false} />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" height={50} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtM} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="Certificado" fill="#4ade80" radius={[3,3,0,0]} opacity={0.85} />
                    <Bar dataKey="Facturado"   fill="#60a5fa" radius={[3,3,0,0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground justify-end">
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block"/>Cert.</span>
                  <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block"/>Fact.</span>
                </div>
              </div>
            )}

            {/* Tabla — ordenable */}
            <div className={`rounded-2xl border border-border/40 bg-card overflow-hidden ${chartData.length > 0 ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
              <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between">
                <p className="text-xs font-bold text-foreground uppercase tracking-wide">Detalle por obra</p>
                <span className="text-[10px] text-muted-foreground">ordená por columna</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/20 bg-muted/10">
                      <SortableTh label="Obra"        sortKey="obra"        currentSort={sort} onSort={onSort} />
                      <SortableTh label="Cert."        sortKey="certificado" currentSort={sort} onSort={onSort} align="right" />
                      <SortableTh label="Fact."        sortKey="facturado"  currentSort={sort} onSort={onSort} align="right" />
                      <SortableTh label="Dif."         sortKey="diferencia" currentSort={sort} onSort={onSort} align="right" />
                      <SortableTh label="Comp."        sortKey="compliance" currentSort={sort} onSort={onSort} align="center" className="hidden sm:table-cell" />
                      <SortableTh label="Avance"       sortKey="avance"     currentSort={sort} onSort={onSort} align="center" className="hidden sm:table-cell" />
                      <SortableTh label="Estado"      sortKey="estado_cobro" currentSort={sort} onSort={onSort} align="center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {sortedRows.map((row, i) => {
                      const cfg = ESTADO_CFG[row.estado_cobro] || ESTADO_CFG.pendiente;
                      const compCls = row.compliance >= 100 ? 'text-emerald-400' : row.compliance >= 75 ? 'text-blue-400' : 'text-amber-400';
                      return (
                        <tr key={i} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-foreground/85 max-w-[120px] truncate" title={row.obra}>{row.obra}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-400 font-semibold tabular-nums whitespace-nowrap">{fmt(row.certificado)}</td>
                          <td className="px-3 py-2.5 text-right text-blue-400 font-semibold tabular-nums whitespace-nowrap">{fmt(row.facturado)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap ${row.diferencia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {row.diferencia < 0 ? '-' : ''}{fmt(Math.abs(row.diferencia))}
                          </td>
                          <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                            <span className={`text-[10px] font-bold ${compCls}`}>{row.compliance}%</span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-muted-foreground hidden sm:table-cell">{row.avance}%</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${cfg.cls}`}>{cfg.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-border/30 bg-muted/10">
                    <tr>
                      <td className="px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-400 tabular-nums">{fmt(totalCert)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-blue-400 tabular-nums">{fmt(totalFac)}</td>
                      <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{diff < 0 ? '-' : ''}{fmt(Math.abs(diff))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}