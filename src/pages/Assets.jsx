import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Cpu } from 'lucide-react';
import PendientesTab from '@/components/assets/PendientesTab';
import ActivosTab from '@/components/assets/ActivosTab';

export default function Assets() {
  return (
    <div className="min-h-screen space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          Pendientes
        </h1>
        <p className="text-slate-400 mt-1">Activos y Equipos — Gestión de trabajos pendientes SAP asignados a jefes de sitio</p>
      </div>

      <Tabs defaultValue="pendientes">
        <TabsList className="bg-slate-800/50 border border-slate-700/50">
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