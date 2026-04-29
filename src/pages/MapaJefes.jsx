import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Users, Map, Layers, Upload, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import MapaJefesVista from '@/components/mapa-jefes/MapaJefesVista';
import ImportarMapaJefes from '@/components/mapa-jefes/ImportarMapaJefes';

export default function MapaJefes() {
  const [modo, setModo] = useState('jefe'); // 'jefe' | 'comuna' | 'cluster'
  const [showImport, setShowImport] = useState(false);

  const { data: direcciones = [], isLoading: loadingDir, refetch: refetchDir } = useQuery({
    queryKey: ['direccionesMapa'],
    queryFn: () => base44.entities.DireccionMapa.list('jefe_sitio', 500),
  });

  const { data: escuelas = [], isLoading: loadingEsc, refetch: refetchEsc } = useQuery({
    queryKey: ['escuelasMapa'],
    queryFn: () => base44.entities.EscuelaMapa.list('nombre', 1000),
  });

  const isLoading = loadingDir || loadingEsc;
  const sinCoords = direcciones.filter(d => !d.lat || !d.lng).length;
  const conCoords = direcciones.filter(d => d.lat && d.lng).length;

  const handleImportDone = () => {
    setShowImport(false);
    refetchDir();
    refetchEsc();
    toast.success('Datos importados correctamente');
  };

  const MODOS = [
    { id: 'jefe', label: 'Por Jefe', icon: Users },
    { id: 'comuna', label: 'Por Comuna', icon: Map },
    { id: 'cluster', label: 'Cluster', icon: Layers },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Mapa de Jefes de Sitio
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {direcciones.length} direcciones · {escuelas.length} escuelas · {conCoords} geocodificadas
            {sinCoords > 0 && <span className="text-amber-600"> · {sinCoords} sin coordenadas</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetchDir(); refetchEsc(); }}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowImport(true)}
            className="gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar Excel
          </Button>
        </div>
      </div>

      {/* Selector de modo */}
      <div className="flex gap-2">
        {MODOS.map(m => (
          <button
            key={m.id}
            onClick={() => setModo(m.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              modo === m.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
            }`}
          >
            <m.icon className="h-4 w-4" />
            {m.label}
          </button>
        ))}
      </div>

      {/* Cuerpo */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : direcciones.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-20">
          <MapPin className="h-16 w-16 text-muted-foreground/30" />
          <div>
            <p className="text-lg font-semibold">No hay datos importados</p>
            <p className="text-sm text-muted-foreground mt-1">
              Importá el archivo Excel para ver las direcciones en el mapa
            </p>
          </div>
          <Button onClick={() => setShowImport(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Importar Excel
          </Button>
        </div>
      ) : (
        <MapaJefesVista direcciones={direcciones} escuelas={escuelas} modo={modo} />
      )}

      {/* Modal importar */}
      {showImport && (
        <ImportarMapaJefes onDone={handleImportDone} onCancel={() => setShowImport(false)} />
      )}
    </div>
  );
}