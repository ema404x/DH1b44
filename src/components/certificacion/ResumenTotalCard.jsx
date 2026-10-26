import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';

export default function ResumenTotalCard({ resumen, fmt }) {
  const montoTotal = resumen.reduce((s, r) => s + r.montoTotal, 0);
  const montoParcial = resumen.reduce((s, r) => s + r.montoParcial, 0);
  const cantListo = resumen.reduce((s, r) => s + r.cantListo, 0);
  const total = resumen.reduce((s, r) => s + r.total, 0);

  return (
    <Card className="border-primary/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total general</span>
          <span className="text-xs text-muted-foreground">{total} obra{total !== 1 ? 's' : ''}</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Monto total</span>
            <span className="text-sm font-bold text-foreground">{fmt(montoTotal)}</span>
          </div>
          <div className="w-full h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Listo certificar ({cantListo})
            </span>
            <span className="text-sm font-bold text-emerald-400">{fmt(montoParcial)}</span>
          </div>
          {montoTotal > 0 && (
            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (montoParcial / montoTotal) * 100)}%` }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}