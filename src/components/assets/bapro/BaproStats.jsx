import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

/** Contadores del encabezado: de la sede elegida o globales. */
export default function BaproStats({ activos, sedeNombre }) {
  const items = [
    { label: sedeNombre ? 'Activos en la sede' : 'Total Activos', value: activos.length, color: 'border-l-slate-400' },
    { label: 'Operativos', value: activos.filter(a => a.status === 'operativo').length, color: 'border-l-emerald-500' },
    { label: 'En Mantenimiento', value: activos.filter(a => a.status === 'en_mantenimiento').length, color: 'border-l-amber-500' },
    { label: 'Vistos BAPRO', value: activos.filter(a => a.visto_bapro).length, color: 'border-l-blue-500' },
  ];
  return (
    <div className="space-y-2">
      {sedeNombre && <p className="text-sm font-semibold">{sedeNombre}</p>}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map(s => (
          <Card key={s.label} className={`border-l-4 ${s.color}`}>
            <CardContent className="pb-3 pt-4">
              <div className="text-2xl font-bold tabular-nums">{s.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}