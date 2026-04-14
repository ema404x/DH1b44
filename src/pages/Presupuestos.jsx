import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PresupuestosLista from '@/components/presupuestos/PresupuestosLista';
import PresupuestoGridPCP from '@/components/presupuestos/PresupuestoGridPCP';
import PlanTrabajosGenerator from '@/components/presupuestos/PlanTrabajosGenerator';

const COLORS = {
  redDark: '#9B1C1C',
  redMain: '#C53030',
  grayDark: '#2D3748',
};

export default function Presupuestos() {
  const [view, setView] = useState('lista'); // 'lista', 'editor', 'plan'
  const [editingId, setEditingId] = useState(null);
  const [editorData, setEditorData] = useState(null);
  const queryClient = useQueryClient();

  const { data: presupuestos = [], isLoading } = useQuery({
    queryKey: ['presupuestosObra'],
    queryFn: () => base44.entities.PresupuestoObraEnhanced.list('-updated_date', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PresupuestoObraEnhanced.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presupuestosObra'] });
      toast.success('Presupuesto creado');
      setView('lista');
      setEditorData(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PresupuestoObraEnhanced.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presupuestosObra'] });
      toast.success('Presupuesto guardado');
      setView('lista');
      setEditorData(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PresupuestoObraEnhanced.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['presupuestosObra'] });
      toast.success('Presupuesto eliminado');
    },
  });

  const handleSave = (cabecera, items) => {
    const dataToSave = {
      ...cabecera,
      grilla_data: items,
      total_presupuesto: items.reduce((sum, row) => sum + (parseFloat(row.subtotal) || 0), 0),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: dataToSave });
    } else {
      createMutation.mutate(dataToSave);
    }
  };

  const handleGenerarPlanTrabajos = (data) => {
    setEditorData({ ...editorData, ...data });
    setView('plan');
  };

  const handleNewPresupuesto = () => {
    setEditingId(null);
    setEditorData({
      codigo: `PPTO-${Date.now()}`,
      cliente_nombre: 'GCBA - MINISTERIO DE EDUCACIÓN',
      empresa: 'MEJORES HOSPITALES S.A.',
      coef_pase: 1.6504,
      coef_oferta: 1.38,
      items: [],
    });
    setView('editor');
  };

  const handleEdit = (presupuesto) => {
    setEditingId(presupuesto.id);
    setEditorData({
      ...presupuesto,
      items: presupuesto.grilla_data || [],
    });
    setView('editor');
  };

  if (view === 'lista') {
    return (
      <div className="min-h-screen p-6" style={{ background: '#F7FAFC' }}>
        <PresupuestosLista
          presupuestos={presupuestos}
          isLoading={isLoading}
          onEdit={handleEdit}
          onDelete={(id) => deleteMutation.mutate(id)}
          onNew={handleNewPresupuesto}
        />
      </div>
    );
  }

  if (view === 'plan' && editorData) {
    return (
      <div className="min-h-screen p-6" style={{ background: '#F7FAFC' }}>
        <PlanTrabajosGenerator
          cabecera={editorData}
          items={editorData.items || []}
          onBack={() => setView('editor')}
        />
      </div>
    );
  }

  if (view === 'editor' && editorData) {
    return (
      <div className="min-h-screen p-6 space-y-4" style={{ background: '#F7FAFC' }}>
        {/* TOP BAR */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setView('lista');
              setEditorData(null);
              setEditingId(null);
            }}
            className="text-sm font-semibold hover:opacity-80"
            style={{ color: COLORS.redDark }}
          >
            ← Volver
          </button>
          <h1 className="text-2xl font-bold" style={{ color: COLORS.redDark }}>
            {editingId ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}
          </h1>
          <Button
            onClick={() => handleSave(editorData, editorData.items || [])}
            disabled={createMutation.isPending || updateMutation.isPending}
            style={{ background: COLORS.redDark, color: 'white' }}
          >
            {createMutation.isPending || updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Guardar
          </Button>
        </div>

        {/* GRID */}
        <PresupuestoGridPCP
          cabecera={editorData}
          onCabeceraChange={(newCabecera) => setEditorData(newCabecera)}
          items={editorData.items || []}
          onItemsChange={(newItems) => setEditorData({ ...editorData, items: newItems })}
          onGenerarPlanTrabajos={handleGenerarPlanTrabajos}
        />
      </div>
    );
  }

  return null;
}