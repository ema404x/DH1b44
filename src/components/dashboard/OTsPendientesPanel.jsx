import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, ClipboardList } from 'lucide-react';

const STATUS_CONFIG = {
  pendiente:   { label: 'Pendiente',   color: '#F59E0B' },
  asignada:    { label: 'Asignada',    color: '#3B82F6' },
  en_progreso: { label: 'En Progreso', color: '#6366F1' },
  en_espera:   { label: 'En Espera',   color: '#94A3B8' },
  completada:  { label: 'Completada',  color: '#10B981' },
  cancelada:   { label: 'Cancelada',   color: '#EF4444' },
};

const PRIORITY_CONFIG = {
  urgente: { label: 'Urgente', color: '#EF4444' },
  alta:    { label: 'Alta',    color: '#F97316' },
  media:   { label: 'Media',   color: '#3B82F6' },
  baja:    { label: 'Baja',    color: '#94A3B8' },
};

export default function OTsPendientesPanel({ orders }) {
  const active = orders.filter(o => !['completada', 'cancelada'].includes(o.status));

  // Datos por estado para el pie
  const byStatus = Object.entries(STATUS_CONFIG)
    .filter(([key]) => key !== 'completada' && key !== 'cancelada')
    .map(([key, cfg]) => ({
      name: cfg.label,
      value: orders.filter(o => o.status === key).length,
      color: cfg.color,
    }))
    .filter(d => d.value > 0);

  // Datos por prioridad (activas)
  const byPriority = Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => ({
    name: cfg.label,
    value: active.filter(o => o.priority === key).length,
    color: cfg.color,
  })).filter(d => d.value > 0);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-semibold">Órdenes de Trabajo</CardTitle>
            <span className="h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center">
              {active.length} activas
            </span>
          </div>
          <Link to="/ordenes">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Pie por estado */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por Estado</p>
            {byStatus.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sin datos</p>
            ) : (
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byStatus} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={56} paddingAngle={2}>
                      {byStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                      formatter={(v, n) => [v, n]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="space-y-1 mt-1">
              {byStatus.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                  </div>
                  <span className="font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Barras por prioridad */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por Prioridad (activas)</p>
            {byPriority.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Sin OTs activas</p>
            ) : (
              <div className="space-y-2.5 mt-3">
                {byPriority.map((d, i) => {
                  const pct = active.length > 0 ? (d.value / active.length) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="font-medium" style={{ color: d.color }}>{d.name}</span>
                        <span className="font-bold text-foreground">{d.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: d.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}