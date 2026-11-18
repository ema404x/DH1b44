import React, { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { desdeHace7Dias, NOMBRES_MEJORA } from '@/lib/optimizaciones';

export default function VerificacionesDialog({ open, onOpenChange }) {
  const desde = useMemo(desdeHace7Dias, []);
  const q = useInfiniteQuery({
    queryKey: ['verificaciones-optimizacion-lista'],
    enabled: open,
    initialPageParam: null,
    queryFn: ({ pageParam }) => base44.entities.VerificacionOptimizacion.filter(
      { fecha: { $gte: desde } },
      { sort: '-fecha', limit: 30, ...(pageParam ? { cursor: pageParam } : {}) },
    ),
    getNextPageParam: (p) => (p?.has_more ? p.next_cursor : undefined),
  });
  const registros = q.data?.pages.flatMap((p) => p?.items || []) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Verificaciones de otros usuarios</DialogTitle>
          <DialogDescription>
            Diferencias de los últimos 7 días entre el camino rápido y el de siempre. A cada usuario
            se le mostró el camino de siempre por el resto de ese día.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {q.isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>}
          {q.isError && <p className="py-6 text-center text-sm text-destructive">No se pudieron cargar los registros.</p>}
          {!q.isLoading && !q.isError && registros.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin diferencias en los últimos 7 días.</p>
          )}
          {registros.map((r) => (
            <details key={r.id} className="rounded-lg border border-border bg-card/40 text-xs">
              <summary className="cursor-pointer px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold text-foreground">{NOMBRES_MEJORA[r.mejora] || r.mejora}</span>
                <span className="font-semibold text-amber-400">
                  {r.cantidad_diferencias} diferencia{r.cantidad_diferencias !== 1 ? 's' : ''}
                </span>
                <span className="text-foreground">{r.usuario_email}</span>
                <span className="text-muted-foreground">{[r.rol, r.sector].filter(Boolean).join(' · ')}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {r.fecha ? format(new Date(r.fecha), 'dd/MM HH:mm') : ''}
                </span>
              </summary>
              <div className="border-t border-border px-3 py-2 space-y-2">
                {r.filtro && <p className="text-muted-foreground">Filtro: {r.filtro}</p>}
                <table className="w-full">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left font-semibold py-1 pr-3">Campo</th>
                      <th className="text-left font-semibold py-1 pr-3">Viejo</th>
                      <th className="text-left font-semibold py-1">Nuevo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(r.detalle || []).map((d, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-3 text-foreground break-all">{d.campo}</td>
                        <td className="py-1 pr-3 text-emerald-400 break-all">{d.valor_viejo || '—'}</td>
                        <td className="py-1 text-amber-400 break-all">{d.valor_nuevo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {r.cantidad_diferencias > (r.detalle?.length || 0) && (
                  <p className="text-muted-foreground">Se guardaron las primeras {r.detalle?.length || 0}.</p>
                )}
              </div>
            </details>
          ))}
          {q.hasNextPage && (
            <div className="pt-1 text-center">
              <Button variant="outline" size="sm" disabled={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                {q.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}