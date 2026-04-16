import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell
} from 'recharts';
import { Activity } from 'lucide-react';
import { startOfMonth, parseISO, isPast } from 'date-fns';

export default function MetricasOperacion({ orders, projects, materials, assets, employees }) {
  const thisMonth = startOfMonth(new Date());

  const totalOrders = orders.length;
  const completadas = orders.filter(o => o.status === 'completada').length;
  const eficiencia = totalOrders > 0 ? Math.round((completadas / totalOrders) * 100) : 0;
  const urgentes = orders.filter(o => ['urgente', 'alta'].includes(o.priority) && !['completada', 'cancelada'].includes(o.status)).length;
  const vencidas = orders.filter(o => o.scheduled_date && isPast(parseISO(o.scheduled_date)) && !['completada', 'cancelada'].includes(o.status)).length;
  const activosOk = assets.filter(a => a.status === 'operativo').length;
  const totalAssets = assets.length;
  const stockOk = materials.filter(m => m.stock > m.min_stock || m.min_stock === 0).length;
  const totalMat = materials.length;
  const empActivos = employees.filter(e => e.status === 'activo').length;
  const proyActivos = projects.filter(p => p.status === 'en_progreso').length;

  // Datos para radar de métricas normalizadas 0-100
  const radarData = [
    { metric: 'Eficiencia OTs', value: eficiencia },
    { metric: 'Activos OK', value: totalAssets > 0 ? Math.round((activosOk / totalAssets) * 100) : 100 },
    { metric: 'Stock OK', value: totalMat > 0 ? Math.round((stockOk / totalMat) * 100) : 100 },
    { metric: 'Emp. Activos', value: employees.length > 0 ? Math.round((empActivos / employees.length) * 100) : 100 },
    { metric: 'Sin Urgencias', value: Math.max(0, 100 - urgentes * 10) },
    { metric: 'Sin Vencidas', value: Math.max(0, 100 - vencidas * 10) },
  ];

  // OTs completadas por mes (últimas 6 semanas aprox.)
  const completadasPorMes = React.useMemo(() => {
    const meses = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('es', { month: 'short' });
      meses[key] = { mes: label, completadas: 0, creadas: 0 };
    }
    orders.forEach(o => {
      const cd = o.created_date;
      if (cd) {
        const k = cd.substring(0, 7);
        if (meses[k]) meses[k].creadas += 1;
      }
      if (o.completed_date && o.status === 'completada') {
        const k = o.completed_date.substring(0, 7);
        if (meses[k]) meses[k].completadas += 1;
      }
    });
    return Object.values(meses);
  }, [orders]);

  const kpis = [
    { label: 'Eficiencia',    value: `${eficiencia}%`,     color: eficiencia >= 70 ? '#10B981' : '#F59E0B' },
    { label: 'Urgentes',      value: urgentes,              color: urgentes === 0 ? '#10B981' : '#EF4444' },
    { label: 'Vencidas',      value: vencidas,              color: vencidas === 0 ? '#10B981' : '#EF4444' },
    { label: 'Proyectos',     value: proyActivos,           color: '#3B82F6' },
    { label: 'Técnicos',      value: empActivos,            color: '#6366F1' },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Métricas de Operación</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">

        {/* KPI Pills */}
        <div className="flex flex-wrap gap-2">
          {kpis.map((k, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1 bg-muted/60 text-[11px]">
              <span className="font-semibold" style={{ color: k.color }}>{k.value}</span>
              <span className="text-muted-foreground">{k.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Radar */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Salud Operativa</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                  <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar OTs por mes */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">OTs Creadas vs Completadas</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completadasPorMes} barGap={2} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Bar dataKey="creadas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Creadas" fillOpacity={0.6} />
                  <Bar dataKey="completadas" fill="#10B981" radius={[3, 3, 0, 0]} name="Completadas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}