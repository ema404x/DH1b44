import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, Database, Plus } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import PresupuestosLista from '@/components/presupuestos/PresupuestosLista';
import PresupuestoEditor from '@/components/presupuestos/PresupuestoEditor';
import PrecarioManager from '@/components/presupuestos/PrecarioManager';

export default function Presupuestos() {
  const [tab, setTab] = useState('presupuestos');
  const [editingPresupuesto, setEditingPresupuesto] = useState(null); // null=lista, 'new'=nuevo, {obj}=editar
  const queryClient = useQueryClient();

  const { data: presupuestos = [], isLoading } = useQuery({
    queryKey: ['presupuestosObra'],
    queryFn: () => base44.entities.PresupuestoObra.list('-created_date'),
  });

  const { data: precario = [] } = useQuery({
    queryKey: ['precario'],
    queryFn: () => base44.entities.PrecarioMinisterio.filter({ activo: true }),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => data.id
      ? base44.entities.PresupuestoObra.update(data.id, data)
      : base44.entities.PresupuestoObra.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presupuestosObra'] });
      setEditingPresupuesto(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PresupuestoObra.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['presupuestosObra'] }),
  });

  if (editingPresupuesto !== null) {
    return (
      <PresupuestoEditor
        presupuesto={editingPresupuesto === 'new' ? null : editingPresupuesto}
        precario={precario}
        onSave={(data) => saveMutation.mutate(data)}
        onCancel={() => setEditingPresupuesto(null)}
        saving={saveMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presupuestos de Obra"
        subtitle="Confección de presupuestos basados en el precario del ministerio"
        actionLabel="Nuevo Presupuesto"
        onAction={() => setEditingPresupuesto('new')}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="presupuestos" className="gap-2">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Presupuestos ({presupuestos.length})
          </TabsTrigger>
          <TabsTrigger value="precario" className="gap-2">
            <Database className="h-3.5 w-3.5" /> Precario Ministerio ({precario.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presupuestos" className="mt-4">
          <PresupuestosLista
            presupuestos={presupuestos}
            isLoading={isLoading}
            onEdit={(p) => setEditingPresupuesto(p)}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        </TabsContent>
        <TabsContent value="precario" className="mt-4">
          <PrecarioManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}