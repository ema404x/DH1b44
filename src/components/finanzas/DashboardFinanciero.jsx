import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, AlertCircle,
  Clock, CheckCircle2, Building2, FileCheck,
} from 'lucide-react';
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);
const fmtAxis = (n) => { if (!n) return '$0'; if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`; if (Math.abs(n) >= 1_000) return `$${(n/1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })}K`; return `$${n}`; };

const PIE_COLORS = ['#F59E0B', '#10B981', '#EF4444', '#6B7280'];
const STATUS_LABELS = { pendiente: 'Pendiente', pagada: 'Pagada', vencida: 'Vencida', cancelada: 'Cancelada' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function KpiCard({ title, value, subtitle, icon: Icon, colorCls, borderCls }) {
  return (
    <Card className={`border ${borderCls}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-xs font-medium mb-1 ${colorCls}`}>{title}</p>
            <p className="text-lg font-bold text-foreground leading-tight tabular-nums">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center bg-current/10`}>
            <Icon className={`h-4 w-4 ${colorCls}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardFinanciero() {
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list(),
    staleTime: 2 * 60 * 1000,
  });
  const { data: certificates = [] } = useQuery({
    queryKey: ['certificados'],
    queryFn: () => base44.entities.Certificado.list(),
    staleTime: 2 * 60 * 1000,
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-certificacion'],
    queryFn: () => base44.entities.ObraCertificacion.list('-created_date', 1000),
    staleTime: 2 * 60 * 1000,
  });

  // ── KPIs ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalFacturado = invoices.reduce((s, i) => s + (i.total || 0), 0);
    const cobrado        = invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
    const pendiente      = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
    const vencido        = invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0);

    // Desde obras: monto total a cobrar vs listo
    const obrasActivas   = obras.filter(o => !o.ciclo_archivado);
    const montoACobrar   = obrasActivas.reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);
    const montoListo     = obrasActivas.filter(o => o.estado_cobro === 'listo_certificar').reduce((s, o) => s + (o.monto_a_cobrar || 0), 0);

    // Certificados emitidos
    const certsAprobados = certificates.filter(c => c.estado === 'aprobado');
    const montoCerts     = certsAprobados.reduce((s, c) => s + (c.subtotal || 0), 0);

    return { totalFacturado, cobrado, pendiente, vencido, montoACobrar, montoListo, montoCerts, cntCerts: certsAprobados.length };
  }, [invoices, obras, certificates]);

  // ── Evolución mensual (facturas por mes) ──────────────────────────────
  const monthlyData = useMemo(() => {
    const map = {};
    invoices.forEach(inv => {
      if (!inv.issue_date) return;
      try {
        const key = format(startOfMonth(parseISO(inv.issue_date)), 'MMM yy', { locale: es });
        if (!map[key]) map[key] = { mes: key, facturado: 0, cobrado: 0, pendiente: 0 };
        map[key].facturado  += (inv.total || 0);
        if (inv.status === 'pagada')    map[key].cobrado   += (inv.total || 0);
        if (inv.status === 'pendiente') map[key].pendiente += (inv.total || 0);
      } catch {}
    });
    return Object.values(map).slice(-12);
  }, [invoices]);

  // ── Distribución por estado (pie) ─────────────────────────────────────
  const pieData = useMemo(() => {
    const byStatus = {};
    invoices.forEach(i => {
      byStatus[i.status] = (byStatus[i.status] || 0) + (i.total || 0);
    });
    return Object.entries(byStatus)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v }));
  }, [invoices]);

  // ── Top clientes ──────────────────────────────────────────────────────
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

  // ── Obras por estado ──────────────────────────────────────────────────
  const obrasEstadoData = useMemo(() => {
    const LABELS = {
      listo_certificar:   'Listo',
      faltan_actas:       'Faltan Actas',
      pendiente:          'Pendiente',
      observado:          'Observado',
      falta_aprobar_mein: 'Falta MEIN',
    };
    const COLORS = {
      listo_certificar: '#10B981',
      faltan_actas:     '#F59E0B',
      pendiente:        '#EF4444',
      observado:        '#94A3B8',
      falta_aprobar_mein: '#A78BFA',
    };
    const activas = obras.filter(o => !o.ciclo_archivado);
    const map = {};
    activas.forEach(o => {
      const k = o.estado_cobro || 'pendiente';
      if (!map[k]) map[k] = { name: LABELS[k] || k, value: 0, monto: 0, color: COLORS[k] || '#94A3B8' };
      map[k].value += 1;
      map[k].monto += (o.monto_a_cobrar || 0);
    });
    return Object.values(map);
  }, [obras]);

  return (
    <div className="space-y-6">

      {/* ── KPIs principales ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Total Facturado"     value={fmt(kpis.totalFacturado)} subtitle={`${invoices.length} facturas`}          icon={DollarSign}    colorCls="text-primary"       borderCls="border-primary/20 bg-primary/5" />
        <KpiCard title="Cobrado"             value={fmt(kpis.cobrado)}        subtitle={`${invoices.filter(i=>i.status==='pagada').length} pagadas`}  icon={CheckCircle2}  colorCls="text-emerald-400"   borderCls="border-emerald-500/20 bg-emerald-500/5" />
        <KpiCard title="Pendiente de Cobro"  value={fmt(kpis.pendiente)}      subtitle={`${invoices.filter(i=>i.status==='pendiente').length} facturas`} icon={Clock}      colorCls="text-amber-400"     borderCls="border-amber-500/20 bg-amber-500/5" />
        <KpiCard title="Vencido Sin Cobrar"  value={fmt(kpis.vencido)}        subtitle={`${invoices.filter(i=>i.status==='vencida').length} facturas`}   icon={AlertCircle} colorCls="text-red-400"       borderCls="border-red-500/20 bg-red-500/5" />
      </div>

      {/* ── Obras en curso ──────────────────────────────────────────────── */}
      {kpis.montoACobrar > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard title="A Cobrar — Obras Activas" value={fmt(kpis.montoACobrar)}  subtitle={`${obras.filter(o=>!o.ciclo_archivado).length} obras activas`} icon={Building2}  colorCls="text-primary"     borderCls="border-primary/20" />
          <KpiCard title="Listo para Certificar"    value={fmt(kpis.montoListo)}    subtitle="Obras en estado listo"  icon={FileCheck}   colorCls="text-emerald-400" borderCls="border-emerald-500/20" />
          <KpiCard title="Certificados Aprobados"   value={fmt(kpis.montoCerts)}    subtitle={`${kpis.cntCerts} certificados`} icon={CheckCircle2} colorCls="text-blue-400"  borderCls="border-blue-500/20" />
        </div>
      )}

      {/* ── Gráficos ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Evolución mensual */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolución mensual de facturación</CardTitle>
            <CardDescription className="text-xs">Últimos 12 meses — facturado vs cobrado</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyData.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">Sin datos suficientes</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={62} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="facturado" name="Facturado"  fill="hsl(var(--primary))" radius={[3,3,0,0]} opacity={0.7} />
                  <Bar dataKey="cobrado"   name="Cobrado"    fill="#10B981"              radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Distribución por estado */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribución por estado</CardTitle>
            <CardDescription className="text-xs">Por monto total</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">Sin datos</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-1">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-muted-foreground">{d.name}</span>
                      </div>
                      <span className="font-semibold text-foreground">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top clientes */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top clientes por monto</CardTitle>
            <CardDescription className="text-xs">Total facturado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topClientes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Sin datos</p>
            ) : topClientes.map((c, i) => (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground/60 font-mono w-4 shrink-0">{i + 1}</span>
                    <span className="text-foreground/80 truncate">{c.name}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">{c.cnt}</Badge>
                  </div>
                  <span className="font-semibold text-foreground shrink-0 ml-2">{fmt(c.total)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${(c.total / topClientes[0].total) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Obras por estado (ciclo activo) */}
        {obrasEstadoData.length > 0 && (
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Obras — ciclo activo</CardTitle>
              <CardDescription className="text-xs">Distribución por estado de cobro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {obrasEstadoData.map(d => (
                <div key={d.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-foreground/80">{d.name}</span>
                      <span className="text-muted-foreground font-semibold">{d.value}</span>
                    </div>
                    <span className="font-semibold text-foreground">{fmt(d.monto)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.value / obras.filter(o=>!o.ciclo_archivado).length) * 100}%`, background: d.color }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}