import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Boxes, ClipboardList, Link2, RefreshCw } from 'lucide-react';
import ActivosTab from '@/components/assets/ActivosTab';
import PendientesTab from '@/components/assets/PendientesTab';
import RevisionBaproPanel from '@/components/assets/RevisionBaproPanel';
import SincronizacionPanel from '@/components/assets/SincronizacionPanel';

export default function Assets() {
  const [tab, setTab] = useState('activos');
  const { data: sedes = [] } = useQuery({ queryKey: ['edificios'], queryFn: () => base44.entities.Edificio.list('-updated_date', 500) });

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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="activos" className="gap-1.5"><Boxes className="h-3.5 w-3.5" />Catálogo</TabsTrigger>
          <TabsTrigger value="pendientes" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" />Pendientes SAP</TabsTrigger>
          <TabsTrigger value="bapro" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Revisión BAPRO</TabsTrigger>
          <TabsTrigger value="sync" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Sincronización</TabsTrigger>
        </TabsList>
        <TabsContent value="activos" className="mt-5"><ActivosTab /></TabsContent>
        <TabsContent value="pendientes" className="mt-5"><PendientesTab /></TabsContent>
        <TabsContent value="bapro" className="mt-5"><RevisionBaproPanel sedes={sedes} /></TabsContent>
        <TabsContent value="sync" className="mt-5"><SincronizacionPanel /></TabsContent>
      </Tabs>
    </div>
  );
}