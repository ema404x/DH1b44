import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, CheckCircle2, Clock, BarChart2 } from 'lucide-react';

export default function ResumenFinanciero({ projects, invoices, quotes }) {
  const totalFacturado = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalCobrado = invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
  const totalPendiente = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
  const totalVencido = invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0);
  const totalPresupuestado = projects.reduce((s, p) => s + (p.estimated_budget || 0), 0);
  const ejecucionPromedio = projects.length > 0
    ? Math.round(projects.reduce((s, p) => s + (p.progress || 0), 0) / projects.length)
    : 0;

  const cards = [
    {
      label: 'Total Facturado', value: `$${totalFacturado.toLocaleString()}`,
      icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-500/10',
      sub: `${invoices.length} facturas`
    },
    {
      label: 'Cobrado', value: `$${totalCobrado.toLocaleString()}`,
      icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10',
      sub: `${Math.round(totalFacturado > 0 ? totalCobrado / totalFacturado * 100 : 0)}% del total`
    },
    {
      label: 'Pendiente de Cobro', value: `$${totalPendiente.toLocaleString()}`,
      icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10',
      sub: totalVencido > 0 ? `+ $${totalVencido.toLocaleString()} vencido` : 'Sin vencidos'
    },
    {
      label: 'Presupuesto Total Proyectos', value: `$${totalPresupuestado.toLocaleString()}`,
      icon: BarChart2, color: 'text-purple-400', bg: 'bg-purple-500/10',
      sub: `${ejecucionPromedio}% ejecución promedio`
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
              <div className={`h-10 w-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}