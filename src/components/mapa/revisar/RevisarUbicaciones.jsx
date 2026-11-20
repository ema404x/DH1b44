import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, Square, MapPinned } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { revisarUbicaciones, errorTexto } from './api';
import useGeocodificar from './useGeocodificar';
import RevisionFila from './RevisionFila';
import RevisionDetalle from './RevisionDetalle';
import RevisionHistorial from './RevisionHistorial';
import GeoProgreso from './GeoProgreso';
import VacioModulo from '@/components/shared/VacioModulo';

const FILTROS = [{ key: 'problemas', label: 'Para revisar' }, { key: 'revisadas', label: 'Revisadas' }, { key: 'todas', label: 'Todas' }];
const PROBLEMA = ['mal_ubicada', 'sin_coordenadas'];
const EN_FILTRO = {
  problemas: (i) => !i.revisada && PROBLEMA.includes(i.estado),
  revisadas: (i) => i.revisada,
  todas: () => true,
};

export default function RevisarUbicaciones() {
  const qc = useQueryClient();
  const [sel, setSel] = useState(null);
  const [filtro, setFiltro] = useState('problemas');
  const [q, setQ] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['revisar-ubicaciones', 'lista'], queryFn: () => revisarUbicaciones('listar') });
  const refrescar = () => qc.invalidateQueries({ queryKey: ['revisar-ubicaciones'] });
  const geo = useGeocodificar(refrescar);

  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.items || []).filter((i) => EN_FILTRO[filtro](i) &&
      (!t || i.nombre.toLowerCase().includes(t) || i.direccion.toLowerCase().includes(t)));
  }, [data, filtro, q]);
  const seleccionado = data?.items?.find((i) => i.clave === sel) || null;

  if (isLoading) return <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <p className="text-sm text-destructive py-8 text-center">{errorTexto(error)}</p>;

  const pendientes = geo.restantes ?? data.pendientes;
  const alHacer = () => {
    setSel(null);
    refrescar();
    qc.invalidateQueries({ queryKey: ['locationData'] });
    qc.invalidateQueries({ queryKey: ['locations'] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 text-sm">
          <p className="font-semibold">Comparar coordenadas con la dirección</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Se busca cada dirección en OpenStreetMap (una por segundo). Nada cambia hasta que tocás un botón. {data.revisadas > 0 && `${data.revisadas} ya revisadas.`}
          </p>
        </div>
        {geo.corriendo
          ? <Button variant="outline" className="gap-2" onClick={geo.detener}><Square className="h-4 w-4" /> Detener</Button>
          : pendientes > 0 && <Button className="gap-2" onClick={() => geo.iniciar(pendientes)}><MapPinned className="h-4 w-4" /> Buscar {pendientes} direcciones</Button>}
      </div>
      {geo.corriendo && <GeoProgreso {...geo.progreso} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button key={f.key} type="button" onClick={() => setFiltro(f.key)}
                className={cn('h-9 px-3 rounded-lg border text-sm', filtro === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground')}>
                {f.label}
              </button>
            ))}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o dirección" className="pl-9 h-9" />
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40 overflow-hidden">
            {items.length ? items.map((i) => <RevisionFila key={i.clave} item={i} activo={i.clave === sel} onClick={() => setSel(i.clave)} />)
              : <div className="p-3"><VacioModulo icon={MapPinned} titulo="No hay ubicaciones en esta vista." texto="Cambiá el filtro o la búsqueda para ver otras ubicaciones." /></div>}
          </div>
        </div>
        <div className="space-y-4 order-first lg:order-none lg:sticky lg:top-4 self-start">
          {seleccionado && <RevisionDetalle key={seleccionado.clave} item={seleccionado} onHecho={alHacer} onCerrar={() => setSel(null)} />}
          <RevisionHistorial />
        </div>
      </div>
    </div>
  );
}