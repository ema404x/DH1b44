import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, AlertTriangle, CheckCircle2, Clock, User } from 'lucide-react';
import { isPast, parseISO, differenceInDays } from 'date-fns';

export default function KpisJefeSitio() {
  const { data: pendientes = [] } = useQuery({
    queryKey: ['pendientes-kpis'],
    queryFn: () => base44.entities.Pendiente.list('-created_date', 500),
    staleTime: 1000 * 60 * 5,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['workorders'],
    queryFn: () => base44.entities.WorkOrder.list('-updated_date', 300),
    staleTime: 1000 * 60 * 5,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
    staleTime: 1000 * 60 * 5,
  });

  // Solo los empleados que son jefes de sitio
  const jefesSitio = useMemo(() => {
    const set = new Set(
      employees
        .filter(e => e.role && e.role.toLowerCase().includes('jefe'))
        .map(e => e.full_name)
    );
    return set;
  }, [employees]);

  const kpis = useMemo(() => {
    if (jefesSitio.size === 0) return [];
    const jefesMap = {};

    pendientes.forEach(p => {
      if (!p.jefe_sitio || !jefesSitio.has(p.jefe_sitio)) return;
      if (!jefesMap[p.jefe_sitio]) jefesMap[p.jefe_sitio] = { pendientes: [], orders: [] };
      jefesMap[p.jefe_sitio].pendientes.push(p);
    });

    // Inicializar jefes sin pendientes también
    jefesSitio.forEach(nombre => {
      if (!jefesMap[nombre]) jefesMap[nombre] = { pendientes: [], orders: [] };
    });

    orders.forEach(o => {
      const nombre = o.assigned_name;
      if (!nombre || !jefesSitio.has(nombre)) return;
      jefesMap[nombre].orders.push(o);
    });

    return Object.entries(jefesMap).map(([nombre, data]) => {
      const totalPend = data.pendientes.length;
      const vencidos = data.pendientes.filter(p =>
        p.fecha_limite && isPast(parseISO(p.fecha_limite)) && p.estado !== 'resuelto' && p.estado !== 'cancelado'
      ).length;
      const resueltos = data.pendientes.filter(p => p.estado === 'resuelto').length;
      const eficienciaPend = totalPend > 0 ? Math.round((resueltos / totalPend) * 100) : 100;

      const otsTotales = data.orders.length;
      const otsCompletadas = data.orders.filter(o => o.status === 'completada').length;
      const eficienciaOTs = otsTotales > 0 ? Math.round((otsCompletadas / otsTotales) * 100) : 100;

      // Tiempo promedio de resolución de pendientes
      const tiemposResolucion = data.pendientes
        .filter(p => p.estado === 'resuelto' && p.fecha_asignacion && p.fecha_resolucion)
        .map(p => differenceInDays(parseISO(p.fecha_resolucion), parseISO(p.fecha_asignacion)))
        .filter(d => d >= 0);
      const promedioResolucion = tiemposResolucion.length > 0
        ? Math.round(tiemposResolucion.reduce((a, b) => a + b, 0) / tiemposResolucion.length)
        : null;

      const score = Math.round((eficienciaPend * 0.5) + (eficienciaOTs * 0.3) + (vencidos === 0 ? 20 : Math.max(0, 20 - vencidos * 4)));

      return { nombre, totalPend, vencidos, resueltos, eficienciaPend, otsTotales, otsCompletadas, eficienciaOTs, promedioResolucion, score };
    }).sort((a, b) => b.score - a.score).slice(0, 10);
  }, [pendientes, orders, jefesSitio]);

  if (kpis.length === 0) return null;

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score) => {
    if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <Card className="border-0 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          KPIs por Jefe de Sitio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {kpis.map((kpi, i) => (
            <div key={kpi.nombre} className={`rounded-xl border p-3 ${getScoreBg(kpi.score)}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{kpi.nombre}</p>
                    <p className="text-xs text-slate-400">
                      {kpi.totalPend} pendientes · {kpi.otsTotales} OTs
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-xl font-bold ${getScoreColor(kpi.score)}`}>{kpi.score}</p>
                  <p className="text-[10px] text-slate-500">score</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Efic. pendientes</span>
                    <span>{kpi.eficienciaPend}%</span>
                  </div>
                  <Progress value={kpi.eficienciaPend} className="h-1.5 bg-white/10" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Efic. OTs</span>
                    <span>{kpi.eficienciaOTs}%</span>
                  </div>
                  <Progress value={kpi.eficienciaOTs} className="h-1.5 bg-white/10" />
                </div>
              </div>

              <div className="flex gap-3 text-[10px] flex-wrap">
                {kpi.vencidos > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <AlertTriangle className="h-3 w-3" /> {kpi.vencidos} vencidos
                  </span>
                )}
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> {kpi.resueltos} resueltos
                </span>
                {kpi.promedioResolucion !== null && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="h-3 w-3" /> {kpi.promedioResolucion}d prom.
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}