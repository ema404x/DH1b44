import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Activity, List, Users, Globe, School, CheckCircle2, Download, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useUbicaciones } from '@/hooks/useUbicaciones';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import ExportarQRsDialog from '@/components/mapa/ExportarQRsDialog';
import MapaFichajes from '@/components/mapa/MapaFichajes';
import LocationsManager from '@/components/mapa/LocationsManager';
import AsignacionesUbicacion from '@/components/mapa/AsignacionesUbicacion';
import MapaProyectosOTs from '@/components/mapa/MapaProyectosOTs';
import MapaColegios from '@/components/mapa/MapaColegios';
import MapaOTsCompletadas from '@/components/mapa/MapaOTsCompletadas';
import AsistenciasPanel from '@/components/mapa/AsistenciasPanel';

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
    queryFn: () => base44.entities.LocationQR.list('-created_date', 500),
    staleTime: 30000,
  });

  // Datos unificados (service role) para mapear cada QR a su jefe de sitio
  // y para exportar SIEMPRE el listado completo de QRs sin depender de RLS.
  const { locationQRs: allQRs, locations: joinedLocations } = useUbicaciones();

  // Filtrar ubicaciones para jefes de sitio: solo ven las asignadas a ellos.
  // Admin y gerente ven todas. Combina asignación manual (jefe_sitio_email)
  // con asignación existente (assigned_employees).
  const { isSuperAdmin, employeeName, currentUser } = useCurrentUser();
  const visibleLocations = useMemo(() => {
    if (isSuperAdmin) return locations;
    const userName = employeeName || currentUser?.full_name || '';
    const userEmail = currentUser?.email || '';
    return locations.filter(loc =>
      loc.jefe_sitio_email === userEmail ||
      loc.jefe_sitio === userName ||
      loc.assigned_employees?.some(a => a === userName || a === currentUser?.id)
    );
  }, [locations, isSuperAdmin, employeeName, currentUser]);

  const visibleQRs = useMemo(() => {
    if (isSuperAdmin) return allQRs;
    const userName = employeeName || currentUser?.full_name || '';
    const userEmail = currentUser?.email || '';
    return allQRs.filter(q =>
      q.jefe_sitio_email === userEmail ||
      q.jefe_sitio === userName ||
      q.assigned_employees?.some(a => a === userName || a === currentUser?.id)
    );
  }, [allQRs, isSuperAdmin, employeeName, currentUser]);

  const jefeByLocId = useMemo(() => {
    const m = new Map();
    for (const ld of joinedLocations) {
      if (ld.location_qr_id) m.set(ld.location_qr_id, ld.jefe_sitio || 'Sin jefe asignado');
    }
    return m;
  }, [joinedLocations]);

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

  const [exportQRsOpen, setExportQRsOpen] = useState(false);

  const handleActivateAll = async () => {
    const inactivas = visibleLocations.filter(l => !l.is_active);
    await Promise.all(inactivas.map(l => base44.entities.LocationQR.update(l.id, { is_active: true })));
    queryClient.invalidateQueries({ queryKey: ['locations'] });
    toast.success(`${inactivas.length} ubicación${inactivas.length !== 1 ? 'es' : ''} activada${inactivas.length !== 1 ? 's' : ''}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            Ubicaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestión de sitios, mapa de fichajes GPS y asignación de cuadrillas
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setExportQRsOpen(true)}
          disabled={locLoading || !visibleQRs.length}
        >
          <Download className="h-4 w-4" />
          Exportar QRs a PDF
        </Button>
      </div>

      <ExportarQRsDialog
        open={exportQRsOpen}
        onOpenChange={setExportQRsOpen}
        locations={visibleQRs}
        jefeByLocId={jefeByLocId}
      />

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
          <TabsTrigger value="asistencias" className="gap-2">
            <Clock className="h-4 w-4" /> Asistencias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proyectos-ots" className="mt-5">
          <MapaProyectosOTs />
        </TabsContent>

        <TabsContent value="mapa" className="mt-5">
          <MapaFichajes
            locations={visibleLocations}
            logs={logs}
            logsLoading={logsLoading}
            onLocationUpdate={(id, data) => updateLocation.mutate({ id, data })}
            onClickToAdd={(coords) => createLocation.mutate({ ...coords, name: 'Nueva ubicación', color: 'blue', is_active: true, event_type: 'ambos' })}
            onGotoGestion={(loc) => { setHighlightedLoc(loc); setTab('gestion'); }}
          />
        </TabsContent>

        <TabsContent value="gestion" className="mt-5">
          <LocationsManager
            locations={visibleLocations}
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
            locations={visibleLocations}
            employees={employees}
            logs={logs}
            onUpdate={(id, data) => updateLocation.mutate({ id, data })}
          />
        </TabsContent>

        <TabsContent value="asistencias" className="mt-5">
          <AsistenciasPanel locations={visibleLocations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}