import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { controlPersonal } from './api';
import { ESTADO_FICHA, normTexto } from './formato';
import EstadoCarga from './EstadoCarga';
import PersonaDetalle from './PersonaDetalle';

export default function PersonasTab({ onConfigurarHorario }) {
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['control-personal', 'personas'],
    queryFn: () => controlPersonal('personas'),
    staleTime: 60000,
  });
  const lista = useMemo(() => {
    const q = normTexto(busqueda);
    return (data?.personas || []).filter((p) => !q || normTexto(p.full_name).includes(q) || String(p.dni).includes(q));
  }, [data, busqueda]);

  if (isLoading || error) return <EstadoCarga error={error} />;
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o DNI…" className="pl-9 h-11" />
      </div>
      {lista.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">No hay operarios para mostrar.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {lista.map((p) => {
            const est = ESTADO_FICHA[p.status] || ESTADO_FICHA.activo;
            return (
              <button key={p.id} type="button" onClick={() => setSel(p)}
                className="acero-quick-item flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-left min-h-[64px]">
                <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
                  {(p.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{p.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{[p.role, p.dni && `DNI ${p.dni}`].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge variant="outline" className={est.cls}>{est.label}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      )}
      <PersonaDetalle persona={sel} onClose={() => setSel(null)} onConfigurarHorario={onConfigurarHorario} />
    </div>
  );
}