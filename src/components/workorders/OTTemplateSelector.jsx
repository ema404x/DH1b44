import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery as useQ, useMutation as useMut, useQueryClient as useQC } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Layers, Plus, Trash2, ChevronRight } from 'lucide-react';

const typeLabels = {
  mantenimiento_preventivo: 'Preventivo', mantenimiento_correctivo: 'Correctivo',
  instalacion: 'Instalación', inspeccion: 'Inspección', reparacion: 'Reparación', emergencia: 'Emergencia'
};

export default function OTTemplateSelector({ open, onOpenChange, onSelect }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const qc = useQC();

  const { data: templates = [] } = useQ({
    queryKey: ['ot-templates'],
    queryFn: () => base44.entities.OTTemplate.list('-created_date'),
    enabled: open,
  });

  const deleteMutation = useMut({
    mutationFn: (id) => base44.entities.OTTemplate.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ot-templates'] }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Plantillas de OT
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {templates.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay plantillas aún. Guardá una OT como plantilla desde el panel de detalle.
            </p>
          )}
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{t.nombre}</p>
                <p className="text-xs text-muted-foreground truncate">{t.title}</p>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{typeLabels[t.type] || t.type}</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                  {t.checklist?.length > 0 && <Badge variant="outline" className="text-[10px]">{t.checklist.length} tareas</Badge>}
                  {t.require_photos && <Badge variant="outline" className="text-[10px] text-amber-600">📷 Fotos req.</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(t.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => { onSelect(t); onOpenChange(false); }}>
                  Usar <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}