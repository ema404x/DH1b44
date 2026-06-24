import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, DollarSign, AlertCircle,
  Clock, CheckCircle2, Building2, FileCheck, ArrowUpRight,
} from 'lucide-react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt  = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtM = (n) => { if (!n) return '$0'; if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`; if (Math.abs(n) >= 1_000) return `$${(n/1_000).toFixed(0)}K`; return `$${n}`; };

const STATUS_LABELS = { pendiente: 'Pendiente', pagada: 'Pagada', vencida: 'Vencida', cancelada: 'Cancelada' };
const STATUS_COLORS = { pendiente: '#F59E0B', pagada: '#10B981', vencida: '#EF4444', cancelada: '#6B7280' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-xl px-3 py-2.5 shadow-xl text-xs backdrop-blur-sm">
      <p className="font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function MetricRow({ label, value, color, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground/80">{label}</span>
        <span className="font-bold text-foreground tabular-nums">{fmt(value)}</span>
      </div>
      <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-px flex-1 bg-border/30" />
      <div className="text-center">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
        {sub && <p className="text-xs text-muted-foreground/60">{sub}</p>}
      </div>
      <div className="h-px flex-1 bg-border/30" />
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, color, glow }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-card p-4 flex flex-col gap-2 ${glow ? 'border-primary/30' : 'border-border/40'}`}>
      {glow && <div className="absolute inset-0 opacity-[0.04]" style={{ background: `radial-gradient(ellipse at top right, ${glow}, transparent 70%)` }} />}
      <div className="flex items-start justify-between relative">
        <p className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{title}</p>
        <Icon className={`h-3.5 w-3.5 ${color} opacity-70`} />
      </div>
      <div className="relative">
        <p className="text-xl font-bold text-foreground tabular-nums leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardFinanciero() {
  const STALE = 2 * 60 * 1000;

  const { data: invoices    = [] } = useQuery({ queryKey: ['invoices'],           queryFn: () => base44.entities.Invoice.list(),                          staleTime: STALE });
  const { data: certificates = [] } = useQuery({ queryKey: ['certificados'],      queryFn: () => base44.entities.Certificado.list(),                      staleTime: STALE });
  const { data: obras        = [] } = useQuery({ queryKey: ['obras-certificacion'],queryFn: () => base44.entities.ObraCertificacion.list('-created_date', 1000), staleTime: STALE });
  const { data: projects     = [] } = useQuery({ queryKey: ['projects'],          queryFn: () => base44.entities.Project.list('-updated_date', 300),      staleTime: STALE });

  const kpis = useMemo(() => {
    const totalFacturado = invoices.reduce((s, i) => s + (i.total || 0), 0);
    const cobrado        = invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
    const pendiente      = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
    const vencido        = invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0);
    const obrasActivas   = obras.filter(o => !o.ciclo_archivado);
    const montoACobrar   = obrasActivas.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const montoListo     = obrasActivas.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const certsAprobados = certificates.filter(c => c.estado === 'aprobado');
    const montoCerts     = certsAprobados.reduce((s, c) => s + (c.subtotal || 0), 0);
    const totalPresup    = projects.reduce((s, p) => s + (p.estimated_budget || 0), 0);
    const ejecucionProm  = projects.length > 0 ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length) : 0;
    const cobPct         = totalFacturado > 0 ? Math.round((cobrado / totalFacturado) * 100) : 0;
    return { totalFacturado, cobrado, pendiente, vencido, montoACobrar, montoListo, montoCerts, cntCerts: certsAprobados.length, totalPresup, ejecucionProm, cobPct, nActivas: obrasActivas.length };
  }, [invoices, obras, certificates, projects]);

  // Evolución mensual
  const monthlyData = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      if (!inv.issue_date) return;
      try {
        const key = format(startOfMonth(parseISO(inv.issue_date)), 'MMM yy', { locale: es });
        if (!map[key]) map[key] = { mes: key, facturado: 0, cobrado: 0 };
        map[key].facturado += (inv.total || 0);
        if (inv.status === 'pagada') map[key].cobrado += (inv.total || 0);
      } catch {}
    });
    return Object.values(map).slice(-10);
  }, [invoices]);

  // Distribución por estado
  const pieData = useMemo(() => {
    const byStatus = {};
    invoices.forEach(i => { byStatus[i.status] = (byStatus[i.status] || 0) + (i.total || 0); });
    return Object.entries(byStatus).filter(([, v]) => v > 0).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v, color: STATUS_COLORS[k] || '#94A3B8' }));
  }, [invoices]);

  // Top clientes
  const topClientes = useMemo(() => {
    const map = {};
    invoices.forEach(i => {
      const k = i.client_name || 'Sin cliente';
      if (!map[k]) map[k] = { name: k, total: 0, cobrado: 0, cnt: 0 };
      map[k].total   += (i.total || 0);
      map[k].cobrado += i.status === 'pagada' ? (i.total || 0) : 0;
      map[k].cnt     += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [invoices]);

  // Obras por estado
  const obrasEstado = useMemo(() => {
    const LABELS = { listo_certificar: 'Listo', faltan_actas: 'Faltan Actas', pendiente: 'Pendiente', observado: 'Observado', falta_aprobar_mein: 'Falta MEIN' };
    const COLORS = { listo_certificar: '#10B981', faltan_actas: '#F59E0B', pendiente: '#EF4444', observado: '#94A3B8', falta_aprobar_mein: '#A78BFA' };
    const map = {};
    obras.filter(o => !o.ciclo_archivado).forEach(o => {
      const k = o.estado_cobro || 'pendiente';
      if (!map[k]) map[k] = { name: LABELS[k] || k, value: 0, monto: 0, color: COLORS[k] || '#94A3B8' };
      map[k].value++; map[k].monto += (o.monto_a_cobrar || 0);
    });
    return Object.values(map).sort((a, b) => b.monto - a.monto);
  }, [obras]);

  const maxMonto = obrasEstado.reduce((m, d) => Math.max(m, d.monto), 0);
  const maxCliente = topClientes[0]?.total || 0;

  return (
    <div className="space-y-8">

      {/* ── Fila 1: KPIs financieros principales ──────────────────────── */}
      <div>
        <SectionHeader title="Facturas" sub="Estado actual de la cartera" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Facturado"    value={fmt(kpis.totalFacturado)} sub={`${invoices.length} facturas`}            icon={DollarSign}   color="text-primary"      glow="hsl(213,90%,55%)" />
          <StatCard title="Cobrado"            value={fmt(kpis.cobrado)}        sub={`${kpis.cobPct}% del total`}              icon={CheckCircle2} color="text-emerald-400"  glow={false} />
          <StatCard title="Pendiente de Cobro" value={fmt(kpis.pendiente)}      sub={`${invoices.filter(i=>i.status==='pendiente').length} fac.`} icon={Clock} color="text-amber-400" glow={false} />
          <StatCard title="Vencido Sin Cobrar" value={fmt(kpis.vencido)}        sub={`${invoices.filter(i=>i.status==='vencida').length} vencidas`} icon={AlertCircle} color="text-red-400" glow={false} />
        </div>
      </div>

      {/* ── Fila 2: KPIs obras + proyectos ─────────────────────────────── */}
      <div>
        <SectionHeader title="Obras & Proyectos" sub="Ciclo activo" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="A Cobrar — Obras"     value={fmt(kpis.montoACobrar)}  sub={`${kpis.nActivas} obras activas`}         icon={Building2}  color="text-sky-400"    glow={false} />
          <StatCard title="Listo para Certificar" value={fmt(kpis.montoListo)}   sub="Estado: listo_certificar"                 icon={FileCheck}  color="text-emerald-400" glow={false} />
          <StatCard title="Presupuesto Proyectos" value={fmt(kpis.totalPresup)}  sub={`${projects.length} proy. · ${kpis.ejecucionProm}% ejec.`} icon={TrendingUp} color="text-purple-400" glow={false} />
          <StatCard title="Certs. Aprobados"      value={fmt(kpis.montoCerts)}   sub={`${kpis.cntCerts} certificados`}          icon={CheckCircle2} color="text-blue-400" glow={false} />
        </div>
      </div>

      {/* ── Fila 3: Gráfico evolución + Pie ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Evolución mensual — área */}
        <div className="lg:col-span-2 rounded-2xl border border-border/40 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Evolución de Facturación</p>
              <p className="text-xs text-muted-foreground">Últimos 10 meses</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary/70 inline-block"/>Facturado</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"/>Cobrado</span>
            </div>
          </div>
          {monthlyData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">Sin datos suficientes</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradFac" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="hsl(213,90%,55%)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(213,90%,55%)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gradCob" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={58} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="facturado" name="Facturado" stroke="hsl(213,90%,55%)" strokeWidth={2} fill="url(#gradFac)" dot={false} />
                <Area type="monotone" dataKey="cobrado"   name="Cobrado"   stroke="#10B981"           strokeWidth={2} fill="url(#gradCob)"  dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie distribución por estado */}
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <p className="text-sm font-semibold text-foreground mb-1">Distribución por Estado</p>
          <p className="text-xs text-muted-foreground mb-4">Por monto total</p>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value" strokeWidth={0}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-bold text-foreground tabular-nums">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Fila 4: Top clientes + Obras por estado ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top clientes */}
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Top Clientes</p>
              <p className="text-xs text-muted-foreground">Por monto facturado</p>
            </div>
          </div>
          {topClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin datos de clientes</p>
          ) : (
            <div className="space-y-3">
              {topClientes.map((c, i) => (
                <div key={c.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground/40 font-mono text-[10px] w-3 shrink-0">{i + 1}</span>
                      <span className="text-foreground/85 truncate font-medium">{c.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{c.cnt}</Badge>
                    </div>
                    <span className="font-bold text-foreground shrink-0 ml-2 tabular-nums">{fmt(c.total)}</span>
                  </div>
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(c.total / maxCliente) * 100}%`, background: `hsl(213,90%,${55 - i * 5}%)` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Obras por estado */}
        <div className="rounded-2xl border border-border/40 bg-card p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-foreground">Obras — Ciclo Activo</p>
            <p className="text-xs text-muted-foreground">Estado de cobro por monto</p>
          </div>
          {obrasEstado.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sin obras activas</p>
          ) : (
            <div className="space-y-4">
              {obrasEstado.map(d => (
                <div key={d.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-foreground/80 font-medium">{d.name}</span>
                      <span className="text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">{d.value}</span>
                    </div>
                    <span className="font-bold text-foreground tabular-nums">{fmt(d.monto)}</span>
                  </div>
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${maxMonto > 0 ? (d.monto / maxMonto) * 100 : 0}%`, background: d.color }} />
                  </div>
                </div>
              ))}

              {/* Resumen total */}
              <div className="pt-3 mt-1 border-t border-border/30 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{kpis.nActivas} obras activas — Total a cobrar</span>
                <span className="font-bold text-foreground tabular-nums">{fmt(kpis.montoACobrar)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}