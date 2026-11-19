import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const SIN_ASIGNAR = '__sin_asignar__';

// Responsable de la OT al aprobar: por defecto el operario que propuso;
// se puede elegir otro operario del sector o dejarla sin asignar.
export default function ResponsableSelect({ value, onChange, solicitante, disabled }) {
  const { data: operarios = [] } = useQuery({
    queryKey: ['operarios-sector-propuestas'],
    queryFn: async () => (await base44.functions.invoke('getOperariosSector')).data?.operarios || [],
    staleTime: 600_000,
    retry: false,
  });
  const opciones = operarios.filter((o) => o.user_id && o.status !== 'inactivo');
  const tieneSolicitante = opciones.some((o) => o.user_id === solicitante?.user_id);

  return (
    <div className="space-y-1">
      <Label className="text-xs">Responsable de la OT</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="Elegí un responsable" /></SelectTrigger>
        <SelectContent>
          {solicitante?.user_id && !tieneSolicitante && (
            <SelectItem value={solicitante.user_id}>{solicitante.nombre || 'Quien propuso'} (propuso)</SelectItem>
          )}
          {opciones.map((o) => (
            <SelectItem key={o.user_id} value={o.user_id}>
              {o.full_name}{o.user_id === solicitante?.user_id ? ' (propuso)' : ''}
            </SelectItem>
          ))}
          <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}