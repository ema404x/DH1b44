import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Building2 } from 'lucide-react';
import VacioModulo from '@/components/shared/VacioModulo';
import { Input } from '@/components/ui/input';
import { controlPersonal } from './api';
import { normTexto } from './formato';
import EstadoCarga from './EstadoCarga';
import LugarCard from './LugarCard';

export default function LugaresTab() {
  const [busqueda, setBusqueda] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['control-personal', 'lugares'],
    queryFn: () => controlPersonal('lugares'),
    staleTime: 60000,
  });
  const lista = useMemo(() => {
    const q = normTexto(busqueda);
    return (data?.lugares || []).filter((l) => !q || normTexto(`${l.name} ${l.address}`).includes(q));
  }, [data, busqueda]);

  if (isLoading || error) return <EstadoCarga error={error} />;
  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar establecimiento…" className="pl-9 h-11" />
      </div>
      {!data?.lugares?.length ? (
        <VacioModulo icon={Building2} titulo="Todavía no hay lugares de fichaje." texto="Los lugares aparecen cuando se crean ubicaciones con QR en el Mapa y tenés acceso a ellas." />
      ) : lista.length === 0 ? (
        <VacioModulo icon={Search} titulo="Ningún lugar coincide con la búsqueda." texto="Probá con otro nombre o dirección." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {lista.map((l) => <LugarCard key={l.id} lugar={l} />)}
        </div>
      )}
    </div>
  );
}