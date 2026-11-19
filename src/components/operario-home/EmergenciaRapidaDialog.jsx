import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EmergenciaForm from '@/components/emergencias/EmergenciaForm';

/** Abre el formulario de emergencias existente desde el Inicio operario. */
export default function EmergenciaRapidaDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    onOpenChange(false);
    ['emergencias', 'workorders', 'workorders-board', 'workorders-operario'].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] })
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-red-500/30 bg-slate-900 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            Registrar Emergencia
          </DialogTitle>
        </DialogHeader>
        {open && <EmergenciaForm onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}