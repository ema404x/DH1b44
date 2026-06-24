import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle2, DollarSign, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt     = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtAxis = (n) => { if (!n) return '$0'; const a = Math.abs(n); if (a >= 1e6) return `$${(n/1e6).toFixed(1)}M`; if (a >= 1000) return `$${(n/1000).toFixed(0)}K`; return `$${n}`; };

const ESTADO_CFG = {
  listo_certificar: { label: 'Listo',       cls: 'bg-emerald-500/12 text-emerald-400' },
  pendiente:        { label: 'Pendiente',    cls: 'bg-red-500/12 text-red-400'         },
  observado:        { label: 'Observado',    cls: 'bg-slate-500/12 text-slate-400'     },
  faltan_actas:     { label: 'Faltan actas', cls: 'bg-amber-500/12 text-amber-400'     },
  falta_aprobar_mein: { label: 'Falta MEIN', cls: 'bg-orange-500/12 text-orange-400'  },
};

const Tip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1 max-w-[160px] truncate">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5 mb-0.5">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function ReporteMensualComparativo() {
  const [mes,       setMes]       = useState(format(new Date(), 'yyyy-MM'));
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const { data: certificados = [] } = useQuery({ queryKey: ['certificados-list'],     queryFn: () => base44.entities.Certificado.list('-fecha_certificado', 500),  staleTime: 2*60*1000 });
  const { data: facturas     = [] } = useQuery({ queryKey: ['invoices-list'],          queryFn: () => base44.entities.Invoice.list('-issue_date', 500),              staleTime: 2*60*1000 });
  const { data: obras        = [] } = useQuery({ queryKey: ['obras-certif-rep'],       queryFn: () => base44.entities.ObraCertificacion.list('-created_date', 500),  staleTime: 2*60*1000 });

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
        r.estado_cobro = o.estado_cobro;
        r.avance = o.porcentaje_avance || 0;
      }
    });

    let list = Array.from(map.values());
    if (filtroEstado !== 'todos') list = list.filter(r => r.estado_cobro === filtroEstado);
    return list;
  }, [certsMes, facsMes, obras, filtroEstado]);

  const totalCert = rows.reduce((s, r) => s + r.certificado, 0);
  const totalFac  = rows.reduce((s, r) => s + r.facturado, 0);
  const diff      = totalCert - totalFac;
  const obrasOk   = rows.filter(r => Math.abs(r.certificado - r.facturado) < 1).length;

  const chartData = rows.slice(0, 8).map(r => ({
    name: r.obra.length > 14 ? r.obra.slice(0, 14) + '…' : r.obra,
    Certificado: r.certificado,
    Facturado:   r.facturado,
  }));

  const DIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;
  const dCls  = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-muted-foreground';

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
        <span className="text-[10px] text-muted-foreground ml-1">{rows.length} obras · {certsMes.length} certificados · {facsMes.length} facturas</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Certificado',      value: fmt(totalCert), sub: `${certsMes.length} certificados`, icon: CheckCircle2, color: 'text-emerald-400', border: 'border-emerald-500/20' },
          { label: 'Facturado',        value: fmt(totalFac),  sub: `${facsMes.length} facturas`,       icon: DollarSign,  color: 'text-blue-400',    border: 'border-blue-500/20'    },
          { label: diff >= 0 ? 'Saldo a favor' : 'Saldo en contra', value: fmt(Math.abs(diff)), sub: diff > 0 ? 'Certificación adelantada' : diff < 0 ? 'Facturación adelantada' : 'Balanceado', icon: DIcon, color: dCls, border: 'border-border/30' },
          { label: 'Obras alineadas',  value: obrasOk,        sub: `de ${rows.length} obras`,          icon: AlertCircle, color: 'text-purple-400',  border: 'border-purple-500/20'  },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={`rounded-2xl border ${k.border} bg-card p-4`}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className={`h-3.5 w-3.5 ${k.color}`} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k.label}</p>
              </div>
              <p className={`text-xl font-bold tabular-nums ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
            </div>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-border/30 bg-card py-14 text-center text-muted-foreground text-sm">Sin datos para el período / filtro seleccionado</div>
      ) : (
        <>
          {/* Gráfico + Tabla lado a lado en desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Gráfico */}
            {chartData.length > 0 && (
              <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card p-5">
                <p className="text-xs font-bold text-foreground uppercase tracking-wide mb-0.5">Top obras — Comparativa</p>
                <p className="text-[11px] text-muted-foreground mb-4">Cert. vs Facturado (primeros 8)</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="2 3" stroke="hsl(var(--border)/0.25)" vertical={false} />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" height={50} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<Tip />} />
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

            {/* Tabla */}
            <div className="lg:col-span-3 rounded-2xl border border-border/40 bg-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border/30">
                <p className="text-xs font-bold text-foreground uppercase tracking-wide">Detalle por obra</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/20 bg-muted/10">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Obra</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cert.</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Fact.</th>
                      <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Dif.</th>
                      <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Av.</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {rows.map((row, i) => {
                      const d = row.certificado - row.facturado;
                      const cfg = ESTADO_CFG[row.estado_cobro] || ESTADO_CFG.pendiente;
                      return (
                        <tr key={i} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-2.5 font-semibold text-foreground/85 max-w-[140px] truncate" title={row.obra}>{row.obra}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-400 font-semibold tabular-nums whitespace-nowrap">{fmt(row.certificado)}</td>
                          <td className="px-3 py-2.5 text-right text-blue-400 font-semibold tabular-nums whitespace-nowrap">{fmt(row.facturado)}</td>
                          <td className={`px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap ${d >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {d < 0 ? '-' : ''}{fmt(Math.abs(d))}
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
                      <td colSpan={2} />
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