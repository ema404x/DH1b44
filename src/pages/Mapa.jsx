import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Activity, List, Users, Globe, School, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import MapaFichajes from '@/components/mapa/MapaFichajes';
import LocationsManager from '@/components/mapa/LocationsManager';
import AsignacionesUbicacion from '@/components/mapa/AsignacionesUbicacion';
import MapaProyectosOTs from '@/components/mapa/MapaProyectosOTs';
import MapaColegios from '@/components/mapa/MapaColegios';
import MapaOTsCompletadas from '@/components/mapa/MapaOTsCompletadas';

export default function Mapa() {
  const [tab, setTab] = useState('mapa');
  const [highlightedLoc, setHighlightedLoc] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = base44.entities.LocationQR.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    });
    return unsubscribe;
  }, [queryClient]);

  const { data: locations = [], isLoading: locLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => base44.entities.LocationQR.list('-created_date', 200),
    staleTime: 30000,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['attendanceLogs'],
    queryFn: () => base44.entities.AttendanceLog.list('-timestamp', 500),
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list(),
    staleTime: 60000,
  });

  const updateLocation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LocationQR.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  });

  const deleteLocation = useMutation({
    mutationFn: (id) => base44.entities.LocationQR.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
  });

  const createLocation = useMutation({
    mutationFn: (data) => base44.entities.LocationQR.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      toast.success('Ubicación creada');
    },
  });

  const handleActivateAll = async () => {
    const inactivas = locations.filter(l => !l.is_active);
    await Promise.all(inactivas.map(l => base44.entities.LocationQR.update(l.id, { is_active: true })));
    queryClient.invalidateQueries({ queryKey: ['locations'] });
    toast.success(`${inactivas.length} ubicación${inactivas.length !== 1 ? 'es' : ''} activada${inactivas.length !== 1 ? 's' : ''}`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          Ubicaciones
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gestión de sitios, mapa de fichajes GPS y asignación de cuadrillas
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-10">
          <TabsTrigger value="proyectos-ots" className="gap-2">
            <Globe className="h-4 w-4" /> Proyectos & OTs
          </TabsTrigger>
          <TabsTrigger value="mapa" className="gap-2">
            <Activity className="h-4 w-4" /> Mapa GPS
          </TabsTrigger>
          <TabsTrigger value="gestion" className="gap-2">
            <List className="h-4 w-4" /> Gestión de Ubicaciones
          </TabsTrigger>
          <TabsTrigger value="colegios" className="gap-2">
            <School className="h-4 w-4" /> Colegios
          </TabsTrigger>
          <TabsTrigger value="asignaciones" className="gap-2">
            <Users className="h-4 w-4" /> Asignaciones
          </TabsTrigger>
          <TabsTrigger value="ots-completadas" className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> OTs Completadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proyectos-ots" className="mt-5">
          <MapaProyectosOTs />
        </TabsContent>

        <TabsContent value="mapa" className="mt-5">
          <MapaFichajes
            locations={locations}
            logs={logs}
            logsLoading={logsLoading}
            onLocationUpdate={(id, data) => updateLocation.mutate({ id, data })}
            onClickToAdd={(coords) => createLocation.mutate({ ...coords, name: 'Nueva ubicación', color: 'blue', is_active: true, event_type: 'ambos' })}
            onGotoGestion={(loc) => { setHighlightedLoc(loc); setTab('gestion'); }}
          />
        </TabsContent>

        <TabsContent value="gestion" className="mt-5">
          <LocationsManager
            locations={locations}
            isLoading={locLoading}
            onUpdate={(id, data) => updateLocation.mutate({ id, data })}
            onDelete={(id) => deleteLocation.mutate(id)}
            onCreate={(data) => createLocation.mutate(data)}
            onActivateAll={handleActivateAll}
            highlightedLocId={highlightedLoc?.id}
            onClearHighlight={() => setHighlightedLoc(null)}
          />
        </TabsContent>

        <TabsContent value="colegios" className="mt-5">
          <MapaColegios />
        </TabsContent>

        <TabsContent value="ots-completadas" className="mt-5">
          <MapaOTsCompletadas />
        </TabsContent>

        <TabsContent value="asignaciones" className="mt-5">
          <AsignacionesUbicacion
            locations={locations}
            employees={employees}
            logs={logs}
            onUpdate={(id, data) => updateLocation.mutate({ id, data })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}