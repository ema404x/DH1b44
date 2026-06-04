import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function EstadisticasAlertas({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Estadísticas (últimos 30 días)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-8">Sin datos</p>
        </CardContent>
      </Card>
    );
  }

  // Agrupar por tipo
  const porTipo = {};
  logs.forEach(log => {
    const tipo = log.tipo || 'sin_tipo';
    if (!porTipo[tipo]) porTipo[tipo] = { total: 0, leidas: 0, no_leidas: 0 };
    porTipo[tipo].total++;
    if (log.leida) porTipo[tipo].leidas++;
    else porTipo[tipo].no_leidas++;
  });

  const dataGrafico = Object.entries(porTipo).map(([tipo, data]) => ({
    tipo: tipo.replace(/_/g, ' '),
    Total: data.total,
    Leídas: data.leidas,
    'No leídas': data.no_leidas,
  }));

  // Stats rápidos
  const stats = [
    { label: 'Total alertas', value: logs.length },
    { label: 'Críticas', value: logs.filter(l => l.nivel === 'critical').length },
    { label: 'No leídas', value: logs.filter(l => !l.leida).length },
    { label: 'Leídas', value: logs.filter(l => l.leida).length },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Estadísticas (últimos 30 días)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {stats.map(s => (
            <div key={s.label} className="p-2 rounded-lg bg-muted/50 border">
              <div className="text-2xl font-bold text-primary">{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataGrafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(200,200,200,0.1)" />
              <XAxis dataKey="tipo" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '4px', fontSize: '10px' }} />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="No leídas" fill="#ef4444" stackId="a" />
              <Bar dataKey="Leídas" fill="#10b981" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}