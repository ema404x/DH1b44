import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ArrowRight, FileCheck, TrendingUp, CheckCircle2, Clock, FileText } from 'lucide-react';
import { startOfMonth, parseISO, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

const ESTADO_CONFIG = {
  borrador: { label: 'Borrador', color: '#94A3B8', bg: 'bg-slate-500/15 text-slate-400' },
  emitido:  { label: 'Emitido',  color: '#3B82F6', bg: 'bg-blue-500/15 text-blue-400' },
  aprobado: { label: 'Aprobado', color: '#10B981', bg: 'bg-emerald-500/15 text-emerald-400' },
};

export default function CertificadosPanel({ filterCutoff = null }) {
  const { data: certs = [] } = useQuery({
    queryKey: ['certificados-dash'],
    queryFn: () => base44.entities.Certificado.list('-created_date', 200),
    staleTime: 1000 * 60 * 5,
  });

  const thisMonth = startOfMonth(new Date());

  // Aplicar filtro de rango de fechas externo si existe, si no usar el mes actual
  const cutoff = filterCutoff || thisMonth;
  const thisMonthCerts = certs.filter(c => c.created_date && parseISO(c.created_date) >= cutoff);
  const emitidos = certs.filter(c => c.estado === 'emitido');
  const aprobados = certs.filter(c => c.estado === 'aprobado');
  const totalMes = thisMonthCerts.reduce((s, c) => s + (c.subtotal || 0), 0);

  // Últimos 6 meses
  const monthlyData = React.useMemo(() => {
    const months = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { month: format(d, 'MMM', { locale: es }), cantidad: 0, monto: 0 };
    }
    certs.forEach(c => {
      const d = c.created_date;
      if (!d) return;
      const key = d.substring(0, 7);
      if (months[key]) {
        months[key].cantidad += 1;
        months[key].monto += c.subtotal || 0;
      }
    });
    return Object.values(months);
  }, [certs]);

  const recentCerts = thisMonthCerts.slice(0, 4);

  // Conteo de abonos por comuna (histórico total)
  const abonosPorComuna = useMemo(() => {
    const comunas = { '8A': 0, '8B': 0, '10A': 0, 'Sin comuna': 0 };
    certs.filter(c => c.tipo === 'abono_mensual').forEach(c => {
      const texto = `${c.emprendimiento || ''} ${c.obra_servicio || ''}`.toUpperCase();
      if (texto.includes('8A') || texto.includes('8 A')) comunas['8A']++;
      else if (texto.includes('8B') || texto.includes('8 B')) comunas['8B']++;
      else if (texto.includes('10A') || texto.includes('10 A')) comunas['10A']++;
      else comunas['Sin comuna']++;
    });
    return comunas;
  }, [certs]);

  const totalAbonos = Object.values(abonosPorComuna).reduce((a, b) => a + b, 0);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-sm font-semibold">Certificados este Mes</CardTitle>
            <span className="h-5 px-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center">
              {thisMonthCerts.length}
            </span>
          </div>
          <Link to="/certificados">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-lg font-bold text-emerald-400 tabular-nums">{thisMonthCerts.length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Este mes</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-lg font-bold text-blue-400 tabular-nums">{emitidos.length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Emitidos</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <p className="text-lg font-bold">{aprobados.length}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Aprobados</p>
          </div>
        </div>

        {/* Monto del mes */}
        {totalMes > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
            <TrendingUp className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-emerald-400/80 font-medium">Monto certificado este mes</p>
              <p className="text-sm font-bold text-emerald-400 tabular-nums">{fmt(totalMes)}</p>
            </div>
          </div>
        )}

        {/* Gráfico de tendencia */}
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Últimos 6 meses</p>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="certGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                  formatter={(v) => [v, 'Certificados']}
                />
                <Area type="monotone" dataKey="cantidad" stroke="#10B981" strokeWidth={2} fill="url(#certGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recientes del mes */}
        {recentCerts.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Recientes</p>
            {recentCerts.map(c => {
              const cfg = ESTADO_CONFIG[c.estado] || ESTADO_CONFIG.borrador;
              return (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.obra_servicio || c.contratista || `Cert. #${c.numero}`}</p>
                    <p className="text-[10px] text-muted-foreground">{c.contratista}</p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${cfg.bg}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {thisMonthCerts.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3 justify-center">
            <Clock className="h-4 w-4" />
            <span>Sin certificados este mes</span>
          </div>
        )}

        {/* Abonos por Comuna — histórico total */}
        {totalAbonos > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Abonos por Comuna (total: {totalAbonos})
            </p>
            <div className="grid grid-cols-3 gap-2">
              {['8A', '8B', '10A'].map(c => (
                <div key={c} className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-2.5 text-center">
                  <p className="text-lg font-bold text-violet-400 tabular-nums">{abonosPorComuna[c]}</p>
                  <p className="text-[10px] text-violet-400/70 font-medium">C. {c}</p>
                </div>
              ))}
            </div>
            {abonosPorComuna['Sin comuna'] > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                + {abonosPorComuna['Sin comuna']} sin comuna asignada
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}