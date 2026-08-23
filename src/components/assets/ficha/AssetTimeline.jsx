import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { History, Wrench, PlusCircle, ArrowRightLeft, PowerOff, DollarSign } from 'lucide-react';
import { fmtCurrency } from '@/lib/format';

// Timeline del lifecycle + costo acumulado (lifecycle cost) al estilo UpKeep.
const eventMeta = {
  creado: { icon: PlusCircle, color: 'text-emerald-600 bg-emerald-50' },
  mantenimiento: { icon: Wrench, color: 'text-blue-600 bg-blue-50' },
  cambio_estado: { icon: ArrowRightLeft, color: 'text-amber-600 bg-amber-50' },
  baja: { icon: PowerOff, color: 'text-red-600 bg-red-50' },
  movimiento: { icon: ArrowRightLeft, color: 'text-slate-600 bg-slate-50' },
  costo: { icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
};

export default function AssetTimeline({ assetId, assetName }) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['asset-history', assetId],
    queryFn: () => base44.entities.AssetHistory.filter({ asset_id: assetId }, '-created_date', 200),
  });

  const lifecycleCost = useMemo(
    () => history.reduce((s, h) => s + (h.costo || 0), 0),
    [history]
  );

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Historial</CardTitle>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">Costo lifecycle</div>
          <div className="text-sm font-bold tabular-nums">{fmtCurrency(lifecycleCost)}</div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10" />)}</div>
        ) : history.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">Sin eventos registrados.</div>
        ) : (
          <div className="relative pl-6 space-y-3.5">
            <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
            {history.map((h) => {
              const meta = eventMeta[h.tipo_evento] || eventMeta.cambio_estado;
              const Icon = meta.icon;
              return (
                <div key={h.id} className="relative">
                  <div className={`absolute -left-[18px] h-5 w-5 rounded-full flex items-center justify-center ${meta.color}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="ml-2">
                    <div className="text-sm font-medium capitalize">{(h.tipo_evento || '').replace('_', ' ')}</div>
                    <div className="text-xs text-muted-foreground">{h.descripcion || '—'}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(h.created_date).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                      {h.usuario ? ` · ${h.usuario}` : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}