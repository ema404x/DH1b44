import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import StatusBadge from '@/components/shared/StatusBadge';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function FlujoDeCaja({ invoices }) {
  const [periodo, setPeriodo] = useState('12');

  const months = eachMonthOfInterval({
    start: subMonths(new Date(), parseInt(periodo) - 1),
    end: new Date(),
  });

  const cashFlowData = months.map(month => {
    const key = format(month, 'yyyy-MM');
    const ingresos = invoices
      .filter(i => i.status === 'pagada' && i.payment_date?.startsWith(key))
      .reduce((s, i) => s + (i.total || 0), 0);
    const porCobrar = invoices
      .filter(i => i.status === 'pendiente' && i.due_date?.startsWith(key))
      .reduce((s, i) => s + (i.total || 0), 0);
    return {
      month: format(month, 'MMM yy', { locale: es }),
      Cobrado: ingresos,
      'Por Cobrar': porCobrar,
      neto: ingresos,
    };
  });

  // Acumulado
  let acumulado = 0;
  const acumuladoData = cashFlowData.map(d => {
    acumulado += d.Cobrado;
    return { ...d, Acumulado: acumulado };
  });

  // Próximos vencimientos
  const proxVencimientos = invoices
    .filter(i => i.status === 'pendiente' && i.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 8);

  const totalProximos = proxVencimientos.reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Flujo de Caja</CardTitle>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={acumuladoData}>
                <defs>
                  <linearGradient id="colorCobrado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAcum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v) => [`$${v.toLocaleString()}`, '']}
                />
                <Area type="monotone" dataKey="Cobrado" stroke="hsl(var(--chart-2))" fill="url(#colorCobrado)" strokeWidth={2} />
                <Area type="monotone" dataKey="Acumulado" stroke="hsl(var(--chart-1))" fill="url(#colorAcum)" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-6 mt-3 text-xs text-muted-foreground justify-end">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Cobrado mensual</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Acumulado</span>
          </div>
        </CardContent>
      </Card>

      {/* Próximos vencimientos */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Próximos Vencimientos</CardTitle>
            <span className="text-sm font-semibold text-amber-600">Total: ${totalProximos.toLocaleString()}</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Proyecto</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proxVencimientos.map(inv => {
                  const daysLeft = Math.ceil((new Date(inv.due_date) - new Date()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysLeft < 0;
                  const isSoon = daysLeft >= 0 && daysLeft <= 7;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.code || '-'}</TableCell>
                      <TableCell className="text-sm font-medium">{inv.client_name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{inv.project_name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isOverdue
                            ? <span className="text-xs font-semibold text-red-600 flex items-center gap-0.5"><ArrowDownRight className="h-3 w-3" />Vencida</span>
                            : isSoon
                            ? <span className="text-xs font-semibold text-amber-600">{daysLeft}d</span>
                            : <span className="text-xs text-muted-foreground">{format(new Date(inv.due_date), 'dd/MM/yy')}</span>
                          }
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">${(inv.total || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
                {proxVencimientos.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No hay facturas pendientes de cobro</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}