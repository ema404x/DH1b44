import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Boxes, ClipboardList, Link2, RefreshCw, Lock } from 'lucide-react';
import ActivosTab from '@/components/assets/ActivosTab';
import PendientesTab from '@/components/assets/PendientesTab';
import RevisionBaproPanel from '@/components/assets/RevisionBaproPanel';
import SincronizacionPanel from '@/components/assets/SincronizacionPanel';
import { usePermission } from '@/hooks/usePermission';

// Mapa de pestaña → moduleKey de permiso. 'sync' hereda el acceso del
// módulo Asset (catálogo) porque es una herramienta administrativa del mismo.
const TAB_MODULE = {
  activos: 'Asset',
  pendientes: 'PendienteSAP',
  bapro: 'RevisionBapro',
  sync: 'Asset',
};

export default function Assets() {
  const [tab, setTab] = useState('activos');
  const { data: sedes = [] } = useQuery({ queryKey: ['edificios'], queryFn: () => base44.entities.Edificio.list('-updated_date', 500) });

  // Permisos por pestaña — se consultan en paralelo.
  const permActivos = usePermission('Asset', 'read');
  const permPendientes = usePermission('PendienteSAP', 'read');
  const permBapro = usePermission('RevisionBapro', 'read');

  const tabPerms = useMemo(() => ({
    activos: permActivos,
    pendientes: permPendientes,
    bapro: permBapro,
    sync: permActivos,
  }), [permActivos, permPendientes, permBapro]);

  // Si la pestaña activa no tiene permiso, caer a la primera que sí lo tenga.
  const activeTab = useMemo(() => {
    if (tabPerms[tab]?.allowed) return tab;
    const firstAllowed = Object.keys(tabPerms).find(t => tabPerms[t]?.allowed);
    return firstAllowed || 'activos';
  }, [tab, tabPerms]);

  const visibleTabs = useMemo(
    () => Object.entries(TAB_MODULE).filter(([, mk]) => tabPerms[Object.keys(TAB_MODULE).find(k => TAB_MODULE[k] === mk)]?.allowed),
    [tabPerms]
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 page-enter">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Boxes className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Activos</h1>
          <p className="text-sm text-muted-foreground">Catálogo de bienes físicos · Import/export · Revisión BAPRO</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="activos" className="gap-1.5" disabled={!permActivos.allowed}><Boxes className="h-3.5 w-3.5" />Catálogo</TabsTrigger>
          <TabsTrigger value="pendientes" className="gap-1.5" disabled={!permPendientes.allowed}><ClipboardList className="h-3.5 w-3.5" />Pendientes SAP</TabsTrigger>
          <TabsTrigger value="bapro" className="gap-1.5" disabled={!permBapro.allowed}><Link2 className="h-3.5 w-3.5" />Revisión BAPRO</TabsTrigger>
          <TabsTrigger value="sync" className="gap-1.5" disabled={!permActivos.allowed}><RefreshCw className="h-3.5 w-3.5" />Sincronización</TabsTrigger>
        </TabsList>
        <TabsContent value="activos" className="mt-5">
          {permActivos.allowed ? <ActivosTab /> : <TabBlocked />}
        </TabsContent>
        <TabsContent value="pendientes" className="mt-5">
          {permPendientes.allowed ? <PendientesTab /> : <TabBlocked />}
        </TabsContent>
        <TabsContent value="bapro" className="mt-5">
          {permBapro.allowed ? <RevisionBaproPanel sedes={sedes} /> : <TabBlocked />}
        </TabsContent>
        <TabsContent value="sync" className="mt-5">
          {permActivos.allowed ? <SincronizacionPanel /> : <TabBlocked />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabBlocked() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <Lock className="h-8 w-8 opacity-50" />
      <p className="text-sm">No tenés permiso para ver esta sección.</p>
    </div>
  );
}