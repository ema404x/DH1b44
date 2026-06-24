import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, CheckCircle2, AlertCircle,
  ArrowUpRight, ArrowDownRight, Filter, FileText, Users
} from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import ReporteMensualComparativo from '@/components/reportes/ReporteMensualComparativo';

const fmt  = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtM = (n) => { if (!n) return '$0'; if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`; if (Math.abs(n) >= 1_000) return `$${(n/1_000).toFixed(0)}K`; return `$${n}`; };

const STATUS_CONFIG = {
  aprobado: { label: 'Aprobado', cls: 'bg-emerald-500/12 text-emerald-400' },
  emitido:  { label: 'Emitido',  cls: 'bg-blue-500/12 text-blue-400'      },
  borrador: { label: 'Borrador', cls: 'bg-muted/60 text-muted-foreground' },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-xl px-3 py-2.5 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: p.fill || p.stroke }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Sección 1: Abonos mensuales ─────────────────────────────────────────────
function AbonosMensualesReporte({ certificados, filtroPeriodo, filtroContratista }) {
  const abonos = useMemo(() => {
    let list = certificados.filter(c => c.tipo === 'abono_mensual' && ['emitido', 'aprobado'].includes(c.estado));
    if (filtroContratista !== 'todos') list = list.filter(c => c.contratista === filtroContratista);
    if (filtroPeriodo !== 'todo') {
      const cutoff = subMonths(new Date(), parseInt(filtroPeriodo));
      list = list.filter(c => {
        const f = c.fecha_certificado || c.mes_periodo;
        return f && new Date(f) >= cutoff;
      });
    }
    return list;
  }, [certificados, filtroPeriodo, filtroContratista]);

  const porMes = useMemo(() => {
    const map = {};
    abonos.forEach(c => {
      const f = c.fecha_certificado || c.mes_periodo;
      if (!f) return;
      const key = format(startOfMonth(new Date(f)), 'MMM yy', { locale: es });
      if (!map[key]) map[key] = { mes: key, total: 0, aprobado: 0, emitido: 0, qty: 0 };
      map[key].total += (c.subtotal || 0);
      map[key][c.estado] = (map[key][c.estado] || 0) + (c.subtotal || 0);
      map[key].qty++;
    });
    return Object.values(map);
  }, [abonos]);

  const porContratista = useMemo(() => {
    const map = {};
    abonos.forEach(c => {
      const k = c.contratista || 'Sin contratista';
      if (!map[k]) map[k] = { nombre: k, total: 0, aprobado: 0, qty: 0 };
      map[k].total    += (c.subtotal || 0);
      map[k].aprobado += c.estado === 'aprobado' ? (c.subtotal || 0) : 0;
      map[k].qty++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [abonos]);

  const totalGeneral  = abonos.reduce((s, c) => s + (c.subtotal || 0), 0);
  const totalAprobado = abonos.filter(c => c.estado === 'aprobado').reduce((s, c) => s + (c.subtotal || 0), 0);
  const promMensual   = porMes.length > 0 ? Math.round(totalGeneral / porMes.length) : 0;
  const maxTotal      = porContratista[0]?.total || 0;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Abonos',     value: fmt(totalGeneral),  sub: `${abonos.length} certificados`,            color: 'text-primary',     border: 'border-primary/20'      },
          { label: 'Aprobados',        value: fmt(totalAprobado), sub: `${abonos.filter(c=>c.estado==='aprobado').length} certif.`, color: 'text-emerald-400', border: 'border-emerald-500/20' },
          { label: 'Prom. Mensual',    value: fmt(promMensual),   sub: `${porMes.length} meses`,                   color: 'text-amber-400',   border: 'border-amber-500/20'    },
          { label: 'Contratistas',     value: porContratista.length, sub: 'con abonos en período',                 color: 'text-purple-400',  border: 'border-purple-500/20'   },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border ${k.border} bg-card p-4`}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${k.color}`}>{k.label}</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {abonos.length === 0 ? (
        <div className="rounded-2xl border border-border/40 bg-card py-12 text-center text-muted-foreground text-sm">Sin datos para el filtro seleccionado</div>
      ) : (
        <>
          {/* Evolución mensual */}
          {porMes.length > 1 && (
            <div className="rounded-2xl border border-border/40 bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-0.5">Evolución Mensual — Abonos</p>
              <p className="text-xs text-muted-foreground mb-4">Monto total por mes</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={porMes}>
                  <defs>
                    <linearGradient id="gradAbono" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(213,90%,55%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(213,90%,55%)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={56} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" name="Total Abonos" stroke="hsl(213,90%,55%)" strokeWidth={2} fill="url(#gradAbono)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Por contratista */}
          <div className="rounded-2xl border border-border/40 bg-card p-5">
            <p className="text-sm font-semibold text-foreground mb-0.5">Gasto por Contratista</p>
            <p className="text-xs text-muted-foreground mb-4">Total acumulado en el período</p>
            <div className="space-y-3">
              {porContratista.map((c, i) => (
                <div key={c.nombre} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground/40 font-mono text-[10px] w-3 shrink-0">{i+1}</span>
                      <span className="font-medium text-foreground/85 truncate">{c.nombre}</span>
                      <span className="text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0">{c.qty}</span>
                    </div>
                    <span className="font-bold text-foreground tabular-nums ml-2">{fmt(c.total)}</span>
                  </div>
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${maxTotal > 0 ? (c.total/maxTotal)*100 : 0}%`, background: `hsl(213,90%,${55-i*5}%)` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabla detallada */}
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border/30 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Detalle de Certificados</p>
                <p className="text-xs text-muted-foreground">{abonos.length} registros en el período</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/20">
                    {['Nº', 'Contratista', 'Obra / Servicio', 'Período', 'Estado', 'Monto'].map(h => (
                      <th key={h} className={`px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px] ${h === 'Monto' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/15">
                  {abonos.slice(0, 50).map(cert => {
                    const sc = STATUS_CONFIG[cert.estado] || STATUS_CONFIG.borrador;
                    return (
                      <tr key={cert.id} className="hover:bg-muted/15 transition-colors">
                        <td className="px-4 py-3 font-mono text-muted-foreground">{cert.numero || '—'}</td>
                        <td className="px-4 py-3 font-medium text-foreground/85">{cert.contratista || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{cert.obra_servicio || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{cert.mes_periodo || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums">{fmt(cert.subtotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-border/30">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums text-sm">{fmt(totalGeneral)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tabs internos ────────────────────────────────────────────────────────────
const REPORT_TABS = [
  { key: 'abonos',   label: 'Abonos Mensuales'       },
  { key: 'certif',   label: 'Certificación Mantenimiento' },
];

export default function ReportesFacturacion() {
  const [tab, setTab]                   = useState('abonos');
  const [filtroPeriodo, setFiltroPeriodo]       = useState('12');
  const [filtroContratista, setFiltroContratista] = useState('todos');

  const { data: certificados = [] } = useQuery({
    queryKey: ['certificados-reportes'],
    queryFn: () => base44.entities.Certificado.list('-fecha_certificado', 500),
    staleTime: 2 * 60 * 1000,
  });

  // Contratistas únicos para el select
  const contratistas = useMemo(() => {
    const set = new Set(certificados.filter(c => c.contratista).map(c => c.contratista));
    return Array.from(set).sort();
  }, [certificados]);

  // Meses disponibles para período
  const meses = useMemo(() => {
    const list = [];
    for (let i = 11; i >= 0; i--) {
      const f = subMonths(new Date(), i);
      list.push({ val: format(f, 'yyyy-MM'), label: format(f, 'MMMM yyyy', { locale: es }).replace(/^\w/, c => c.toUpperCase()) });
    }
    return list;
  }, []);

  return (
    <div className="space-y-6">

      {/* ── Header + filtros globales ─────────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-card px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Reportes Financieros</p>
            <p className="text-xs text-muted-foreground">Análisis detallado por tipo de certificado y período</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {/* Período */}
            <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
                <SelectItem value="todo">Todo el historial</SelectItem>
              </SelectContent>
            </Select>
            {/* Contratista */}
            <Select value={filtroContratista} onValueChange={setFiltroContratista}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Contratista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los contratistas</SelectItem>
                {contratistas.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-0 mt-4 border-b border-border/30 -mx-5 px-5">
          {REPORT_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors
                ${tab === key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
              {tab === key && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido por tab ────────────────────────────────────── */}
      <div className="page-enter" key={tab}>
        {tab === 'abonos' && (
          <AbonosMensualesReporte
            certificados={certificados}
            filtroPeriodo={filtroPeriodo}
            filtroContratista={filtroContratista}
          />
        )}
        {tab === 'certif' && (
          <ReporteMensualComparativo />
        )}
      </div>
    </div>
  );
}