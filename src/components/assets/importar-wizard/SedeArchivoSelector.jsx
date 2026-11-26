import React, { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import SedeBuscador from '@/components/assets/bapro/SedeBuscador';
import { ordenarSedes } from '@/components/assets/bapro/sedesBapro';

export const SEDE_AUTO = '__auto';

// "Sede de este archivo": por defecto se detecta desde el archivo; si se elige una
// sede, todas las filas van a ella (se envía como sede_id).
export default function SedeArchivoSelector({ sedes, value, onChange }) {
  const options = useMemo(() => [
    { value: SEDE_AUTO, label: 'Detectar desde el archivo (columna Sucursal/Sede o nombre de la hoja)' },
    ...ordenarSedes(sedes || []).map(s => ({ value: s.id, label: s.nombre })),
  ], [sedes]);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="flex-1 text-xs space-y-2">
        <div>
          <p className="font-medium mb-0.5">Sede de este archivo</p>
          <p className="text-muted-foreground">Si elegís una sede, todos los activos van a ella y se ignora la columna de sede.</p>
        </div>
        <SedeBuscador options={options} value={value} onChange={onChange} placeholder="Detectar desde el archivo" />
      </div>
    </div>
  );
}