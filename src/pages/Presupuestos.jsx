import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Database, Loader2 } from 'lucide-react';
import PresupuestosLista from '@/components/presupuestos/PresupuestosLista';
import PresupuestoEditor from '@/components/presupuestos/PresupuestoEditor';
import PrecarioManager from '@/components/presupuestos/PrecarioManager';
import { toast } from 'sonner';

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
      toast.success('Presupuesto guardado');
    },
    onError: () => toast.error('Error al guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PresupuestoObra.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presupuestosObra'] });
      toast.success('Presupuesto eliminado');
    },
  });

  // Full-screen editor
  if (editingPresupuesto !== null) {
    return (
      <div className="px-0">
        <PresupuestoEditor
          presupuesto={editingPresupuesto === 'new' ? null : editingPresupuesto}
          onSave={(data) => saveMutation.mutate(data)}
          onCancel={() => setEditingPresupuesto(null)}
          saving={saveMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Presupuestos de Obra</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Armá presupuestos con el preciario ministerial y exportá en formato PCP.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 h-9">
          <TabsTrigger value="presupuestos" className="gap-2 text-sm">
            <FileText className="h-3.5 w-3.5" />
            Presupuestos
            {presupuestos.length > 0 && (
              <span className="ml-1 text-xs bg-muted rounded px-1.5 py-0.5 font-medium text-muted-foreground">
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : presupuestos.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="precario" className="gap-2 text-sm">
            <Database className="h-3.5 w-3.5" />
            Preciario Ministerio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="presupuestos" className="mt-5">
          <PresupuestosLista
            presupuestos={presupuestos}
            isLoading={isLoading}
            onEdit={(p) => setEditingPresupuesto(p)}
            onDelete={(id) => deleteMutation.mutate(id)}
            onNew={() => setEditingPresupuesto('new')}
          />
        </TabsContent>

        <TabsContent value="precario" className="mt-5">
          <PrecarioManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}