import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Filter, TrendingUp, BadgeDollarSign, CircleCheck, Building2 } from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import ReporteMensualComparativo from '@/components/reportes/ReporteMensualComparativo';
import { fmt, fmtM, pct, ChartTip, KpiCard, KpiSkeleton, TableSkeleton, SortableTh, useTableSort } from '@/components/reportes/shared';

const SC = {
  aprobado: { label: 'Aprobado', cls: 'bg-emerald-500/12 text-emerald-400' },
  emitido:  { label: 'Emitido',  cls: 'bg-blue-500/12 text-blue-400'      },
  borrador: { label: 'Borrador', cls: 'bg-muted/50 text-muted-foreground' },
};

// ─── Reporte de Abonos ──────────────────────────────────────────────────────
function AbonosReporte({ certs, periodo, contratista, estado }) {
  const data = useMemo(() => {
    let list = certs.filter(c => c.tipo === 'abono_mensual');
    if (estado !== 'todos') list = list.filter(c => c.estado === estado);
    else list = list.filter(c => ['emitido', 'aprobado'].includes(c.estado));
    if (contratista !== 'todos') list = list.filter(c => c.contratista === contratista);
    if (periodo !== 'todo') {
      const cutoff = subMonths(new Date(), parseInt(periodo));
      list = list.filter(c => { const f = c.fecha_certificado || c.mes_periodo; return f && new Date(f) >= cutoff; });
    }
    return list;
  }, [certs, periodo, contratista, estado]);

  const porMes = useMemo(() => {
    const map = {};
    data.forEach(c => {
      const f = c.fecha_certificado || c.mes_periodo; if (!f) return;
      const d = new Date(f); if (isNaN(d)) return;
      const k = format(startOfMonth(d), 'MMM yy', { locale: es });
      const ts = startOfMonth(d).getTime();
      if (!map[k]) map[k] = { mes: k, ts, total: 0, aprobado: 0, emitido: 0, qty: 0 };
      map[k].total     += c.subtotal || 0;
      map[k][c.estado]  = (map[k][c.estado] || 0) + (c.subtotal || 0);
      map[k].qty++;
    });
    return Object.values(map).sort((a, b) => a.ts - b.ts);
  }, [data]);

  const porContratista = useMemo(() => {
    const map = {};
    data.forEach(c => {
      const k = c.contratista || 'Sin contratista';
      if (!map[k]) map[k] = { nombre: k, total: 0, aprobado: 0, qty: 0 };
      map[k].total    += c.subtotal || 0;
      map[k].aprobado += c.estado === 'aprobado' ? (c.subtotal || 0) : 0;
      map[k].qty++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [data]);

  const total    = data.reduce((s, c) => s + (c.subtotal || 0), 0);
  const aprobado = data.filter(c => c.estado === 'aprobado').reduce((s, c) => s + (c.subtotal || 0), 0);
  const promMes  = porMes.length > 0 ? Math.round(total / porMes.length) : 0;
  const pctAprob = total > 0 ? Math.round((aprobado / total) * 100) : 0;
  const maxC     = porContratista[0]?.total || 1;

  // Delta vs mes anterior
  const ultimo   = porMes[porMes.length - 1]?.total || 0;
  const penult   = porMes[porMes.length - 2]?.total || 0;
  const deltaMes = penult > 0 ? Math.round(((ultimo - penult) / penult) * 100) : null;

  // Tablas ordenables
  const { sort, onSort, sorted: sortedRows } = useTableSort(
    data.slice(0, 50).map(c => ({
      numero: String(c.numero || ''), contratista: c.contratista || '', obra: c.obra_servicio || '', mes: c.mes_periodo || '', estado: c.estado, subtotal: c.subtotal || 0,
    })),
  );

  const { sorted: sortedContratistas } = useTableSort(porContratista);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card py-16 text-center">
        <BadgeDollarSign className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Sin datos para los filtros seleccionados.</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Ajustá período o contratista para ver certificados.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total período"    value={fmt(total)}            sub={`${data.length} certificados`}                                       icon={BadgeDollarSign} accent="primary" delta={deltaMes} />
        <KpiCard label="Aprobados"        value={fmt(aprobado)}          sub={`${pctAprob}% del total`}                                            icon={CircleCheck}    accent="emerald"   />
        <KpiCard label="Prom. mensual"    value={fmt(promMes)}           sub={`${porMes.length} meses con datos`}                                  icon={TrendingUp}     accent="amber"     />
        <KpiCard label="Contratistas"     value={porContratista.length}  sub="activos en el período"                                               icon={Building2}      accent="purple"    />
      </div>

      {/* Gráfico + Ranking lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {porMes.length > 1 && (
          <div className="rounded-2xl border border-border/40 bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-foreground uppercase tracking-wide">Evolución mensual</p>
                <p className="text-[11px] text-muted-foreground">Emitidos + aprobados</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase">Último mes</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{fmt(ultimo)}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={porMes} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(213,90%,55%)" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="hsl(213,90%,55%)" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 3" stroke="hsl(var(--border)/0.25)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtM} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="total" name="Total" stroke="hsl(213,90%,55%)" strokeWidth={2} fill="url(#gA)" dot={{ r: 2.5, fill: 'hsl(213,90%,55%)' }} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ranking contratistas */}
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-bold text-foreground uppercase tracking-wide">Ranking contratistas</p>
              <p className="text-[11px] text-muted-foreground">Por monto en el período</p>
            </div>
            <span className="text-[10px] text-muted-foreground">{porContratista.length} total</span>
          </div>
          <div className="space-y-3">
            {sortedContratistas.slice(0, 6).map((c, i) => {
              const apr = Math.round((c.aprobado / (c.total || 1)) * 100);
              const sharePct = Math.round((c.total / (total || 1)) * 100);
              return (
                <div key={c.nombre} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`font-mono text-[9px] w-4 text-center shrink-0 ${i < 3 ? 'text-amber-400 font-bold' : 'text-muted-foreground/40'}`}>{i+1}</span>
                    <span className="font-semibold text-foreground/90 truncate flex-1">{c.nombre}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{sharePct}%</span>
                    <span className="font-bold text-foreground tabular-nums shrink-0">{fmt(c.total)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pl-5">
                    <div className="h-1 flex-1 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.total/maxC)*100}%`, background: `hsl(213,90%,${Math.max(40,55-i*4)}%)` }} />
                    </div>
                    <span className="text-[9px] text-emerald-400 font-semibold w-9 text-right shrink-0">{apr}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabla detalle — ordenable */}
      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between">
          <p className="text-xs font-bold text-foreground uppercase tracking-wide">Detalle de certificados</p>
          <span className="text-[10px] text-muted-foreground">{data.length} registros · {data.length > 50 ? 'primeros 50 — ' : ''}ordená por columna</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/20 bg-muted/10">
                <SortableTh label="Nº"            sortKey="numero"      currentSort={sort} onSort={onSort} className="font-mono" />
                <SortableTh label="Contratista"   sortKey="contratista" currentSort={sort} onSort={onSort} />
                <SortableTh label="Obra / Servicio" sortKey="obra"     currentSort={sort} onSort={onSort} className="hidden md:table-cell" />
                <SortableTh label="Período"       sortKey="mes"        currentSort={sort} onSort={onSort} className="hidden sm:table-cell" />
                <SortableTh label="Estado"        sortKey="estado"     currentSort={sort} onSort={onSort} />
                <SortableTh label="Monto"         sortKey="subtotal"    currentSort={sort} onSort={onSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {sortedRows.map((cert, idx) => {
                const sc = SC[cert.estado] || SC.borrador;
                return (
                  <tr key={idx} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{cert.numero || '—'}</td>
                    <td className="px-4 py-2.5 font-semibold text-foreground/85 max-w-[140px] truncate">{cert.contratista || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-[180px] truncate hidden md:table-cell">{cert.obra || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{cert.mes || '—'}</td>
                    <td className="px-4 py-2.5"><span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${sc.cls}`}>{sc.label}</span></td>
                    <td className="px-4 py-2.5 text-right font-bold text-foreground tabular-nums">{fmt(cert.subtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border/30 bg-muted/10">
              <tr>
                <td colSpan={5} className="px-4 py-2.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Total período</td>
                <td className="px-4 py-2.5 text-right font-bold text-foreground tabular-nums">{fmt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Root ───────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'abonos', label: 'Abonos Mensuales'           },
  { key: 'certif', label: 'Certificación Mantenimiento' },
];

export default function ReportesFacturacion() {
  const [tab,         setTab]         = useState('abonos');
  const [periodo,     setPeriodo]     = useState('12');
  const [contratista, setContratista] = useState('todos');
  const [estado,      setEstado]      = useState('todos');

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ['certs-reportes'],
    queryFn:  () => base44.entities.Certificado.list('-fecha_certificado', 500),
    staleTime: 2 * 60 * 1000,
  });

  const contratistas = useMemo(() => {
    const s = new Set(certs.filter(c => c.contratista).map(c => c.contratista));
    return Array.from(s).sort();
  }, [certs]);

  return (
    <div className="space-y-5">
      {/* Barra de filtros + tabs */}
      <div className="rounded-2xl border border-border/40 bg-card px-5 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground leading-tight">Reportes Financieros</p>
            <p className="text-xs text-muted-foreground">Filtros en tiempo real · {isLoading ? 'cargando…' : `${certs.length} certificados cargados`}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
                <SelectItem value="todo">Todo el historial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contratista} onValueChange={setContratista}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los contratistas</SelectItem>
                {contratistas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {tab === 'abonos' && (
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aprobado">Aprobados</SelectItem>
                  <SelectItem value="emitido">Emitidos</SelectItem>
                  <SelectItem value="borrador">Borradores</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex -mx-5 px-5 border-t border-border/20 pt-3 gap-1">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`relative px-4 py-1.5 text-xs font-semibold rounded-lg transition-all
                ${tab === key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/20'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="page-enter" key={tab}>
        {tab === 'abonos' && (isLoading
          ? <div className="space-y-5"><KpiSkeleton /><TableSkeleton rows={6} cols={4} /></div>
          : <AbonosReporte certs={certs} periodo={periodo} contratista={contratista} estado={estado} />)}
        {tab === 'certif' && <ReporteMensualComparativo />}
      </div>
    </div>
  );
}