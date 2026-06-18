import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Building2, ClipboardList, Settings, Send, Zap, Users } from 'lucide-react';
import CatalogoRutinas from '@/components/rutinas/CatalogoRutinas';
import AsignacionEdificio from '@/components/rutinas/AsignacionEdificio';
import TableroOrdenes from '@/components/rutinas/TableroOrdenes';
import GenerarOTsJefes from '@/components/rutinas/GenerarOTsJefes';
import SincronizarEdificios from '@/components/rutinas/SincronizarEdificios';
import TableroJefeSitio from '@/components/rutinas/tablero-jefes/TableroJefeSitio';

export default function Rutinas() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #0A2540 0%, #0d2e4a 60%, #0f3460 100%)' }}>
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #D4AF37, #b8960f)' }}>
            <Settings className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Módulo de Rutinas de Mantenimiento
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#D4AF37' }}>
              Anexo 3 PETP — DGMESC · DH1 Software
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-6">
        <Tabs defaultValue="sincronizar">
          <TabsList className="mb-6 bg-white/5 border border-white/10 p-1 gap-1">
            {[
              { value: 'sincronizar', icon: Zap, label: 'Sincronizar' },
              { value: 'jefes', icon: Users, label: 'Tablero por Jefe' },
              { value: 'tablero', icon: ClipboardList, label: 'Tablero General' },
              { value: 'generar-ots', icon: Send, label: 'Generar OTs' },
              { value: 'catalogo', icon: BookOpen, label: 'Catálogo' },
              { value: 'asignacion', icon: Building2, label: 'Asignación' },
            ].map(({ value, icon: Icon, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex items-center gap-2 data-[state=active]:text-white data-[state=inactive]:text-white/50 data-[state=active]:shadow-sm px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ '--tw-ring-color': '#D4AF37' }}
              >
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="sincronizar">
            <SincronizarEdificios />
          </TabsContent>
          <TabsContent value="jefes">
            <TableroJefeSitio />
          </TabsContent>
          <TabsContent value="tablero">
            <TableroOrdenes />
          </TabsContent>
          <TabsContent value="generar-ots">
            <GenerarOTsJefes />
          </TabsContent>
          <TabsContent value="catalogo">
            <CatalogoRutinas />
          </TabsContent>
          <TabsContent value="asignacion">
            <AsignacionEdificio />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}