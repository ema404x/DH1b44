import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export default function ResumenFinanciero({ projects, invoices, quotes }) {
  const totalFacturado = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalCobrado = invoices.filter(i => i.status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
  const totalPendiente = invoices.filter(i => i.status === 'pendiente').reduce((s, i) => s + (i.total || 0), 0);
  const totalVencido = invoices.filter(i => i.status === 'vencida').reduce((s, i) => s + (i.total || 0), 0);

  const totalPresupuestado = projects.reduce((s, p) => s + (p.estimated_budget || 0), 0);
  const totalCostos = projects.reduce((s, p) => s + (p.actual_cost || 0), 0);
  const rentabilidadGlobal = totalFacturado > 0 ? ((totalFacturado - totalCostos) / totalFacturado * 100).toFixed(1) : 0;

  const cards = [
    {
      label: 'Total Facturado', value: `$${totalFacturado.toLocaleString()}`,
      icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50',
      sub: `${invoices.length} facturas`
    },
    {
      label: 'Cobrado', value: `$${totalCobrado.toLocaleString()}`,
      icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50',
      sub: `${Math.round(totalFacturado > 0 ? totalCobrado / totalFacturado * 100 : 0)}% del total`
    },
    {
      label: 'Pendiente de Cobro', value: `$${totalPendiente.toLocaleString()}`,
      icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50',
      sub: totalVencido > 0 ? `+ $${totalVencido.toLocaleString()} vencido` : 'Sin vencidos'
    },
    {
      label: 'Rentabilidad Global', value: `${rentabilidadGlobal}%`,
      icon: rentabilidadGlobal >= 0 ? TrendingUp : TrendingDown,
      color: rentabilidadGlobal >= 20 ? 'text-emerald-600' : rentabilidadGlobal >= 0 ? 'text-amber-600' : 'text-red-600',
      bg: rentabilidadGlobal >= 20 ? 'bg-emerald-50' : rentabilidadGlobal >= 0 ? 'bg-amber-50' : 'bg-red-50',
      sub: `Costos: $${totalCostos.toLocaleString()}`
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