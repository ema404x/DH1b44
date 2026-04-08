import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, Database } from 'lucide-react';
import PresupuestosLista from '@/components/presupuestos/PresupuestosLista';
import PresupuestoEditor from '@/components/presupuestos/PresupuestoEditor';
import PrecarioManager from '@/components/presupuestos/PrecarioManager';

export default function Presupuestos() {
  const [tab, setTab] = useState('presupuestos');
  const [editingPresupuesto, setEditingPresupuesto] = useState(null);
  const queryClient = useQueryClient();

  const { data: presupuestos = [], isLoading } = useQuery({
    queryKey: ['presupuestosObra'],
    queryFn: () => base44.entities.PresupuestoObra.list('-created_date'),
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
        onSave={(data) => saveMutation.mutate(data)}
        onCancel={() => setEditingPresupuesto(null)}
        saving={saveMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="presupuestos" className="gap-2">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Presupuestos <span className="ml-1 text-xs text-muted-foreground">({presupuestos.length})</span>
            </TabsTrigger>
            <TabsTrigger value="precario" className="gap-2">
              <Database className="h-3.5 w-3.5" />
              Preciario Ministerio
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="presupuestos" className="mt-4">
          <PresupuestosLista
            presupuestos={presupuestos}
            isLoading={isLoading}
            onEdit={(p) => setEditingPresupuesto(p)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onNew={() => setEditingPresupuesto('new')}
          />
        </TabsContent>
        <TabsContent value="precario" className="mt-4">
          <PrecarioManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}