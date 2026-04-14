import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Cpu } from 'lucide-react';
import PendientesTab from '@/components/assets/PendientesTab';
import ActivosTab from '@/components/assets/ActivosTab';

export default function Assets() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          Pendientes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Activos y Equipos — Gestión de trabajos pendientes SAP asignados a jefes de sitio</p>
      </div>

      <Tabs defaultValue="pendientes">
        <TabsList>
          <TabsTrigger value="pendientes" className="gap-1.5">
            <ClipboardList className="h-4 w-4" /> Pendientes SAP
          </TabsTrigger>
          <TabsTrigger value="activos" className="gap-1.5">
            <Cpu className="h-4 w-4" /> Activos y Equipos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pendientes" className="mt-4">
          <PendientesTab />
        </TabsContent>

        <TabsContent value="activos" className="mt-4">
          <ActivosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}