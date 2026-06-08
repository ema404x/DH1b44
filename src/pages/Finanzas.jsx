import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, BarChart2, ArrowLeftRight } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RentabilidadProyectos from '@/components/finanzas/RentabilidadProyectos';
import FlujoDeCaja from '@/components/finanzas/FlujoDeCaja';
import ResumenFinanciero from '@/components/finanzas/ResumenFinanciero';

export default function Finanzas() {
  // Reutiliza las mismas query keys del Dashboard para aprovechar el caché existente.
  // staleTime de 2 min: suficiente para análisis financiero sin generar tráfico excesivo.
  const STALE_2M = 2 * 60 * 1000;
  const { data: projects = [] } = useQuery({ queryKey: ['projects'],  queryFn: () => base44.entities.Project.list('-updated_date', 300),  staleTime: STALE_2M });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'],  queryFn: () => base44.entities.Invoice.list('-created_date', 500),  staleTime: STALE_2M });
  const { data: quotes = [] }   = useQuery({ queryKey: ['quotes'],    queryFn: () => base44.entities.Quote.list('-created_date', 300),    staleTime: STALE_2M });

  return (
    <div className="space-y-6">
      <PageHeader title="Gestión Financiera" subtitle="Costos, rentabilidad y flujo de caja" />

      <ResumenFinanciero projects={projects} invoices={invoices} quotes={quotes} />

      <Tabs defaultValue="rentabilidad">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="rentabilidad" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Rentabilidad
          </TabsTrigger>
          <TabsTrigger value="flujo" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" /> Flujo de Caja
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rentabilidad" className="mt-6">
          <RentabilidadProyectos projects={projects} invoices={invoices} />
        </TabsContent>

        <TabsContent value="flujo" className="mt-6">
          <FlujoDeCaja invoices={invoices} />
        </TabsContent>
      </Tabs>
    </div>
  );
}