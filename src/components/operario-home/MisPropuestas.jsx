import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb, ChevronRight, WifiOff } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { offlineQueryOptions } from '@/hooks/useOfflineMode';
import { resolverPropuesta } from '@/lib/propuestasOT';
import { abrirOTOperario } from '@/lib/modoOperario';
import * as store from '@/lib/offlineStore';

const ESTADO = {
  enviada: { label: 'Esperando a tu jefe', cls: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
  aprobada: { label: 'Aprobada', cls: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30' },
  rechazada: { label: 'Rechazada', cls: 'bg-red-400/15 text-red-300 border-red-400/30' },
  cola: { label: 'Se enviará con señal', cls: 'bg-muted text-muted-foreground border-border' },
};

/** "Mis propuestas" del Inicio operario: últimas 5, con las que esperan señal. */
export default function MisPropuestas() {
  const { user, offlineMode } = useAuth();
  const cacheKey = `mis-propuestas-${user?.id || 'anon'}`;
  const [enCola, setEnCola] = useState([]);

  const { data: propuestas = [] } = useQuery({
    queryKey: ['mis-propuestas-ot'],
    initialData: () => { try { return JSON.parse(localStorage.getItem(cacheKey)) || []; } catch { return []; } },
    queryFn: async () => {
      const list = (await resolverPropuesta({ action: 'mias', limit: 5 })).solicitudes || [];
      try { localStorage.setItem(cacheKey, JSON.stringify(list)); } catch { /* sin espacio */ }
      return list;
    },
    staleTime: 60_000,
    retry: false,
    ...offlineQueryOptions(offlineMode),
  });

  useEffect(() => {
    const leer = () => store.getOps()
      .then((ops) => setEnCola(ops.filter((o) => o.kind === 'create_solicitud')))
      .catch(() => setEnCola([]));
    leer();
    return store.subscribe(leer);
  }, []);

  const items = [
    ...enCola.map((o) => ({ id: o.id, titulo: o.data?.titulo, estado: 'cola' })),
    ...propuestas,
  ].slice(0, 5);

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Mis propuestas</h2>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-8 text-center">
          <Lightbulb className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium text-muted-foreground">¿Viste algo para arreglar? Proponé una OT.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((p) => {
            const e = ESTADO[p.estado] || ESTADO.enviada;
            const tappable = p.estado === 'aprobada' && p.work_order_id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={!tappable}
                onClick={() => tappable && abrirOTOperario(p.work_order_id)}
                className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors active:bg-accent disabled:active:bg-card"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-card-foreground">{p.titulo}</p>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${e.cls}`}>
                    {p.estado === 'cola' && <WifiOff className="h-3 w-3" />}
                    {e.label}{p.estado === 'aprobada' && p.work_order_code ? ` · OT #${p.work_order_code}` : ''}
                  </span>
                  {p.estado === 'rechazada' && p.motivo_rechazo && (
                    <p className="mt-1 text-sm text-red-300">{p.motivo_rechazo}</p>
                  )}
                </div>
                {tappable && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}