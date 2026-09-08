import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { RefreshCw, Building2, Percent } from 'lucide-react';
import { fmt, fmtM, ChartTip } from '@/components/reportes/shared';
import { netoCertificado } from '@/components/finanzas/abonoNeto';

// Desglose mensual NETO de abonos vs obras (últimos 12 meses).
// Recibe certificados ya filtrados por tipo.
export default function AbonosMensualesChart({ certificadosAbono, certificadosObra }) {
  const { monthlyData, kpisMes } = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(startOfMonth(now), i);
      months.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM yy', { locale: es }) });
    }

    const data = months.map((m) => {
      const abonos = (certificadosAbono || []).filter((c) => c.mes_periodo === m.key);
      const obras = (certificadosObra || []).filter((c) => c.mes_periodo === m.key);
      const netoAbonos = abonos.reduce((s, c) => s + netoCertificado(c), 0);
      const netoObras = obras.reduce((s, c) => s + netoCertificado(c), 0);
      return { mes: m.label, abonos: netoAbonos, obras: netoObras, total: netoAbonos + netoObras };
    });

    const mesActualKey = format(startOfMonth(now), 'yyyy-MM');
    const abonosMes = (certificadosAbono || []).filter((c) => c.mes_periodo === mesActualKey).reduce((s, c) => s + netoCertificado(c), 0);
    const obrasMes = (certificadosObra || []).filter((c) => c.mes_periodo === mesActualKey).reduce((s, c) => s + netoCertificado(c), 0);
    const pctAbono = abonosMes + obrasMes > 0 ? Math.round((abonosMes / (abonosMes + obrasMes)) * 100) : 0;

    return {
      monthlyData: data,
      kpisMes: { abonosMes, obrasMes, pctAbono },
    };
  }, [certificadosAbono, certificadosObra]);

  return (
    <div className="space-y-4">
      {/* KPIs del mes actual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiMini label="Abonos — Neto este mes" value={fmt(kpisMes.abonosMes)} sub="Certificado real (neto)" icon={RefreshCw} hex="#fbbf24" />
        <KpiMini label="Obras — Neto este mes" value={fmt(kpisMes.obrasMes)} sub="Para contraste" icon={Building2} hex="#60a5fa" />
        <KpiMini label="% Abonos del mes" value={`${kpisMes.pctAbono}%`} sub="Del total certificado" icon={Percent} hex="#34d399" />
      </div>

      {/* Gráfico */}
      <div className="rounded-2xl border border-border/40 bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Desglose Mensual Neto</p>
            <p className="text-xs text-muted-foreground">Últimos 12 meses · Abonos vs Obras</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Abonos (neto)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />Obras (neto)</span>
          </div>
        </div>
        {monthlyData.every((d) => d.abonos === 0 && d.obras === 0) ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Sin certificados en el período</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAbono" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradObraN" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.3)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtM} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={58} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="abonos" name="Abonos (neto)" stroke="#fbbf24" strokeWidth={2} fill="url(#gradAbono)" dot={false} />
              <Area type="monotone" dataKey="obras" name="Obras (neto)" stroke="#60a5fa" strokeWidth={2} fill="url(#gradObraN)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function KpiMini({ label, value, sub, icon: Icon, hex }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-4">
      <div className="absolute inset-0 opacity-[0.05]" style={{ background: `radial-gradient(ellipse at top right, ${hex}, transparent 70%)` }} />
      <div className="flex items-start justify-between relative">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 opacity-70" style={{ color: hex }} />
      </div>
      <p className="text-xl font-bold tabular-nums text-foreground mt-2 relative">{value}</p>
      <p className="text-[11px] text-muted-foreground relative">{sub}</p>
    </div>
  );
}