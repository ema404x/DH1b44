import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StatusBadge from '@/components/shared/StatusBadge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function RentabilidadProyectos({ projects, invoices }) {
  // Build per-project financials
  const projectData = projects
    .filter(p => p.estimated_budget > 0 || p.actual_cost > 0)
    .map(p => {
      const projectInvoices = invoices.filter(i => i.project_name === p.name);
      const facturado = projectInvoices.reduce((s, i) => s + (i.total || 0), 0);
      const cobrado = projectInvoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
      const costos = p.actual_cost || 0;
      const presupuesto = p.estimated_budget || 0;
      const margen = facturado > 0 ? ((facturado - costos) / facturado * 100) : 0;
      const desviacion = presupuesto > 0 ? ((costos - presupuesto) / presupuesto * 100) : 0;
      return { ...p, facturado, cobrado, costos, presupuesto, margen, desviacion };
    })
    .sort((a, b) => b.facturado - a.facturado);

  const chartData = projectData.slice(0, 6).map(p => ({
    name: p.name.length > 18 ? p.name.substring(0, 18) + '…' : p.name,
    Presupuesto: p.presupuesto,
    Facturado: p.facturado,
    Costos: p.costos,
  }));

  const MargenIcon = ({ value }) => {
    if (value >= 20) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    if (value >= 0) return <Minus className="h-4 w-4 text-amber-500" />;
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const margenColor = (v) => v >= 20 ? 'text-emerald-600 font-semibold' : v >= 0 ? 'text-amber-600 font-semibold' : 'text-red-600 font-semibold';

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Presupuesto vs Facturado vs Costos por Proyecto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v) => [`$${v.toLocaleString()}`, '']}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Presupuesto" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Facturado" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Costos" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rentabilidad por Proyecto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                  <TableHead className="text-right">Costos Reales</TableHead>
                  <TableHead className="text-right">Facturado</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead className="hidden lg:table-cell">Ejecución</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectData.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.client_name}</p>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge value={p.status} /></TableCell>
                    <TableCell className="text-right text-sm">${p.presupuesto.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-sm">
                      <span className={p.desviacion > 10 ? 'text-red-600' : ''}>
                        ${p.costos.toLocaleString()}
                        {p.desviacion !== 0 && p.presupuesto > 0 && (
                          <span className="text-xs ml-1">({p.desviacion > 0 ? '+' : ''}{p.desviacion.toFixed(0)}%)</span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm">${p.facturado.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <MargenIcon value={p.margen} />
                        <span className={margenColor(p.margen)}>{p.margen.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell w-32">
                      <div className="flex items-center gap-2">
                        <Progress value={p.progress || 0} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground">{p.progress || 0}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {projectData.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay proyectos con datos financieros cargados</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}