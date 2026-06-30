import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, ArrowLeftRight, FileCheck } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import RentabilidadProyectos from '@/components/finanzas/RentabilidadProyectos';
import FlujoDeCaja from '@/components/finanzas/FlujoDeCaja';
import ResumenFinanciero from '@/components/finanzas/ResumenFinanciero';

export default function Finanzas() {
  // La empresa opera con Obras, Certificados y Abonos — no usa facturas.
  // staleTime 2 min: suficiente para análisis financiero sin tráfico excesivo.
  const STALE_2M = 2 * 60 * 1000;
  const { data: obras = [] }        = useQuery({ queryKey: ['obras-certificacion'], queryFn: () => base44.entities.ObraCertificacion.list('-created_date', 2000), staleTime: STALE_2M });
  const { data: certificados = [] } = useQuery({ queryKey: ['certificados'],         queryFn: () => base44.entities.Certificado.list('-created_date', 2000),       staleTime: STALE_2M });
  const { data: abonos = [] }       = useQuery({ queryKey: ['abonos-maestro'],        queryFn: () => base44.entities.AbonoMaestro.list('-created_date', 500),        staleTime: STALE_2M });
  const { data: projects = [] }     = useQuery({ queryKey: ['projects'],              queryFn: () => base44.entities.Project.list('-updated_date', 500),             staleTime: STALE_2M });

  return (
    <div className="space-y-6">
      <PageHeader title="Gestión Financiera" subtitle="Cartera de obras, certificaciones y abonos mensuales" />

      <ResumenFinanciero obras={obras} certificados={certificados} abonos={abonos} projects={projects} />

      <Tabs defaultValue="certificacion">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="certificacion" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" /> Certificación
          </TabsTrigger>
          <TabsTrigger value="flujo" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" /> Flujo de Caja
          </TabsTrigger>
        </TabsList>

        <TabsContent value="certificacion" className="mt-6">
          <RentabilidadProyectos projects={projects} certificados={certificados} obras={obras} />
        </TabsContent>

        <TabsContent value="flujo" className="mt-6">
          <FlujoDeCaja certificados={certificados} obras={obras} abonos={abonos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}