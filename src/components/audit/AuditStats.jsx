import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, BarChart3, Database, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { ACTION_CONFIG, ENTITY_LABELS, PIE_COLORS } from '@/components/audit/auditConfig';

const TOOLTIP = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 };
const porCantidad = (a, b) => b.count - a.count;

// Registros por día de la última semana, dentro del rango de fechas filtrado.
async function actividadSemanal(query) {
  const hoy = new Date();
  return Promise.all([6, 5, 4, 3, 2, 1, 0].map(async (i) => {
    const dia = subDays(hoy, i);
    let desde = startOfDay(dia).toISOString();
    let hasta = endOfDay(dia).toISOString();
    if (query.timestamp?.$gte > desde) desde = query.timestamp.$gte;
    if (query.timestamp?.$lte < hasta) hasta = query.timestamp.$lte;
    const value = desde > hasta ? 0
      : await base44.entities.AuditLog.count({ ...query, timestamp: { $gte: desde, $lte: hasta } });
    return { name: format(dia, 'dd/MM'), value };
  }));
}

export default function AuditStats({ resumen, query }) {
  const { data: byDay = [] } = useQuery({
    queryKey: ['auditSemana', JSON.stringify(query)],
    queryFn: () => actividadSemanal(query),
  });

  const byAction = useMemo(() => (resumen?.porAccion || []).map(r => ({
    name: ACTION_CONFIG[r.action]?.label || r.action, value: r.count,
  })), [resumen]);

  const byEntity = useMemo(() => [...(resumen?.porEntidad || [])].sort(porCantidad).slice(0, 8).map(r => ({
    name: ENTITY_LABELS[r.entity_type] || r.entity_type, value: r.count,
  })), [resumen]);

  const byUser = useMemo(() => [...(resumen?.porUsuario || [])].sort(porCantidad).slice(0, 5), [resumen]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 bg-slate-800/40 border-slate-700/50">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Actividad últimos 7 días</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byDay}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 bg-slate-800/40 border-slate-700/50">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Distribución por tipo de acción</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie data={byAction} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                  {byAction.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {byAction.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5 bg-slate-800/40 border-slate-700/50">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Módulos más activos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byEntity} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={TOOLTIP} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 bg-slate-800/40 border-slate-700/50">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Usuarios más activos</h3>
          <div className="space-y-3">
            {byUser.map((u, i) => (
              <div key={u.user_email} className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate">{u.user_email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(u.count / (byUser[0]?.count || 1)) * 100}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{u.count}</span>
                  </div>
                </div>
              </div>
            ))}
            {byUser.length === 0 && <p className="text-sm text-slate-500 text-center py-4">Sin datos</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}