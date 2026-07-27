import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function InformesStats({ informes, vencidos }) {
  const stats = [
    {
      label: 'Total Informes', value: informes.length,
      icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10',
    },
    {
      label: 'Pendientes', value: informes.filter(i => ['pendiente', 'en_preparacion'].includes(i.estado)).length,
      icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10',
    },
    {
      label: 'Entregados', value: informes.filter(i => ['enviado', 'aprobado'].includes(i.estado)).length,
      icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10',
    },
    {
      label: 'Vencidos / Urgentes', value: vencidos.length,
      icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(s => (
        <Card key={s.label}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className={`h-10 w-10 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}