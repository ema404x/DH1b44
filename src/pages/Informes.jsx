import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import InformesStats from '@/components/informes/InformesStats';
import InformesAlertas from '@/components/informes/InformesAlertas';
import InformesTabla from '@/components/informes/InformesTabla';
import InformeFormDialog from '@/components/informes/InformeFormDialog';

export default function Informes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: informes = [], isLoading } = useQuery({
    queryKey: ['informes'],
    queryFn: () => base44.entities.InformePlaneacion.list('-created_date'),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? base44.entities.InformePlaneacion.update(editing.id, data)
      : base44.entities.InformePlaneacion.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['informes'] });
      setDialogOpen(false);
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InformePlaneacion.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['informes'] }),
  });

  const handleEdit = (informe) => { setEditing(informe); setDialogOpen(true); };
  const handleNew = () => { setEditing(null); setDialogOpen(true); };

  const pendientes = informes.filter(i => ['pendiente', 'en_preparacion'].includes(i.estado));
  const enviados = informes.filter(i => ['enviado', 'aprobado', 'rechazado'].includes(i.estado));

  // Auto-detect vencidos
  const today = new Date();
  const vencidos = informes.filter(i =>
    i.fecha_limite && new Date(i.fecha_limite) < today && !['enviado', 'aprobado'].includes(i.estado)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Informes"
        subtitle="Control de informes entregados y pendientes"
        actionLabel="Nuevo Informe"
        onAction={handleNew}
      />

      <InformesAlertas informes={informes} />
      <InformesStats informes={informes} vencidos={vencidos} />

      <Tabs defaultValue="todos">
        <TabsList>
          <TabsTrigger value="todos" className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> Todos ({informes.length})
          </TabsTrigger>
          <TabsTrigger value="pendientes" className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" /> Pendientes ({pendientes.length})
          </TabsTrigger>
          <TabsTrigger value="entregados" className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" /> Entregados ({enviados.length})
          </TabsTrigger>
          <TabsTrigger value="vencidos" className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Vencidos ({vencidos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="mt-4">
          <InformesTabla informes={informes} onEdit={handleEdit} onDelete={(id) => deleteMutation.mutate(id)} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="pendientes" className="mt-4">
          <InformesTabla informes={pendientes} onEdit={handleEdit} onDelete={(id) => deleteMutation.mutate(id)} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="entregados" className="mt-4">
          <InformesTabla informes={enviados} onEdit={handleEdit} onDelete={(id) => deleteMutation.mutate(id)} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="vencidos" className="mt-4">
          <InformesTabla informes={vencidos} onEdit={handleEdit} onDelete={(id) => deleteMutation.mutate(id)} isLoading={isLoading} highlight="vencido" />
        </TabsContent>
      </Tabs>

      <InformeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editing}
        onSave={(data) => saveMutation.mutate(data)}
        saving={saveMutation.isPending}
      />
    </div>
  );
}