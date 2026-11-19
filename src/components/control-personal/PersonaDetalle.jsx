import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { controlPersonal } from './api';
import { ESTADO_FICHA } from './formato';
import EstadoCarga from './EstadoCarga';
import PersonaResumen from './PersonaResumen';
import PersonaHoras from './PersonaHoras';
import PersonaHistorial from './PersonaHistorial';

export default function PersonaDetalle({ persona, onClose, onConfigurarHorario }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['control-personal', 'persona', persona?.id],
    queryFn: () => controlPersonal('persona', { employeeId: persona.id }),
    enabled: Boolean(persona),
  });
  const est = ESTADO_FICHA[persona?.status] || ESTADO_FICHA.activo;

  return (
    <Dialog open={Boolean(persona)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 flex-wrap pr-6">
            <span>{persona?.full_name}</span>
            <Badge variant="outline" className={est.cls}>{est.label}</Badge>
          </DialogTitle>
          <p className="text-xs text-muted-foreground text-left">
            {[persona?.role, persona?.dni && `DNI ${persona.dni}`, persona?.assigned_jefe_sitio && `Jefe: ${persona.assigned_jefe_sitio}`].filter(Boolean).join(' · ')}
          </p>
        </DialogHeader>
        {isLoading || error ? <EstadoCarga error={error} /> : data && (
          <div className="space-y-5">
            <PersonaResumen data={data} onConfigurarHorario={() => { onClose(); onConfigurarHorario?.(); }} />
            <PersonaHoras semanas={data.semanas} meses={data.meses} />
            <PersonaHistorial items={data.historial} total={data.totalFichajes} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}