import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import StatusBadge from '@/components/shared/StatusBadge';

export default function RentabilidadProyectos({ projects, invoices }) {
  const projectData = projects
    .filter(p => p.estimated_budget > 0)
    .map(p => {
      const presupuesto = p.estimated_budget || 0;
      const ejecucion = p.progress || 0;
      return { ...p, presupuesto, ejecucion };
    })
    .sort((a, b) => b.presupuesto - a.presupuesto);

  const chartData = projectData.slice(0, 6).map(p => ({
    name: p.name.length > 18 ? p.name.substring(0, 18) + '…' : p.name,
    Presupuesto: p.presupuesto,
    'Ejecución %': p.ejecucion,
  }));

  return (
    <div className="space-y-6">
      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Presupuesto por Proyecto</CardTitle>
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
                  formatter={(v, name) => [name === 'Ejecución %' ? `${v}%` : `$${v.toLocaleString()}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Presupuesto" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Proyectos por Presupuesto y Ejecución</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Presupuesto Total</TableHead>
                  <TableHead>% Ejecución</TableHead>
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
                    <TableCell className="text-right text-sm font-semibold">${p.presupuesto.toLocaleString()}</TableCell>
                    <TableCell className="w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={p.ejecucion} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{p.ejecucion}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {projectData.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay proyectos con presupuesto cargado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}