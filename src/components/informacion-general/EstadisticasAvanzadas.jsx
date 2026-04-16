import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, Users, Building2, Map } from 'lucide-react';

export default function EstadisticasAvanzadas({ locations, comunas }) {
  // Datos por comuna
  const dataPorComuna = useMemo(() => {
    return comunas.map(c => ({
      name: c.id,
      escuelas: locations.filter(l => l.comuna === c.id).length,
      superficie: locations.filter(l => l.comuna === c.id).reduce((s, l) => s + (l.m2 || 0), 0),
      jefes: new Set(locations.filter(l => l.comuna === c.id).map(l => l.jefe_sitio)).size,
    }));
  }, [locations, comunas]);

  // Top jefes de sitio
  const topJefes = useMemo(() => {
    const jefes = {};
    locations.forEach(l => {
      const jefe = l.jefe_sitio || 'Sin asignar';
      if (!jefes[jefe]) jefes[jefe] = 0;
      jefes[jefe]++;
    });
    return Object.entries(jefes)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [locations]);

  // Estado de escuelas
  const dataEstado = useMemo(() => [
    { name: 'Activas', value: locations.filter(l => l.estado === 'activo').length, color: '#10b981' },
    { name: 'Inactivas', value: locations.filter(l => l.estado === 'inactivo').length, color: '#ef4444' },
  ], [locations]);

  // Distribución de m2
  const distribM2 = useMemo(() => {
    return comunas.map(c => ({
      name: c.id,
      m2: locations.filter(l => l.comuna === c.id).reduce((s, l) => s + (l.m2 || 0), 0),
    }));
  }, [locations, comunas]);

  const colors = ['#3b82f6', '#a855f7', '#10b981'];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-primary" /> Reportes y Análisis
      </h2>

      {/* Grid de 4 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Escuelas', value: locations.length, icon: Building2, color: 'from-blue-500' },
          { label: 'Activas', value: locations.filter(l => l.estado === 'activo').length, icon: TrendingUp, color: 'from-emerald-500' },
          { label: 'Jefes Asignados', value: new Set(locations.map(l => l.jefe_sitio).filter(Boolean)).size, icon: Users, color: 'from-purple-500' },
          { label: 'M² Total', value: `${(locations.reduce((s, l) => s + (l.m2 || 0), 0) / 1000).toFixed(1)}K`, icon: Map, color: 'from-orange-500' },
        ].map((stat, idx) => (
          <Card key={idx} className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.color} to-transparent flex items-center justify-center text-white`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Escuelas por Comuna */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Escuelas por Comuna</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dataPorComuna}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="escuelas" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Estado de Escuelas */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Estado de Escuelas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dataEstado}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {dataEstado.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-4">
              {dataEstado.map((item, idx) => (
                <div key={idx} className="text-center">
                  <div className="h-3 w-3 rounded-full mx-auto mb-1" style={{ backgroundColor: item.color }} />
                  <p className="text-xs font-medium text-slate-600">{item.name}</p>
                  <p className="text-lg font-bold">{item.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Superficie por Comuna */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Superficie (m²) por Comuna</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={distribM2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }} />
                <Line type="monotone" dataKey="m2" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Jefes de Sitio */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top Jefes de Sitio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topJefes.map((jefe, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium text-slate-700 truncate">{jefe.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${(jefe.count / topJefes[0].count) * 100}%` }}
                      />
                    </div>
                    <Badge variant="secondary">{jefe.count}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Detalle */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Resumen por Comuna</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Comuna</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Escuelas</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Superficie (m²)</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">Jefes</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-700">% Total</th>
                </tr>
              </thead>
              <tbody>
                {dataPorComuna.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <Badge variant="secondary">{row.name}</Badge>
                    </td>
                    <td className="text-center py-3 px-4 font-semibold">{row.escuelas}</td>
                    <td className="text-center py-3 px-4">{row.superficie.toLocaleString()}</td>
                    <td className="text-center py-3 px-4">{row.jefes}</td>
                    <td className="text-center py-3 px-4">
                      <span className="text-primary font-semibold">
                        {((row.escuelas / locations.length) * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}