import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import SedeBuscador from '@/components/assets/bapro/SedeBuscador';
import { ordenarSedes } from '@/components/assets/bapro/sedesBapro';

// Solo BAPRO: selector con buscador de sedes (Edificio del sector).
// Sede Central primero, después alfabético. onChange recibe el Edificio elegido.
export default function SedeInspeccionField({ sedes, value, onChange }) {
  const options = useMemo(
    () => ordenarSedes((sedes || []).filter(s => s.activo !== false)).map(s => ({ value: s.nombre, label: s.nombre })),
    [sedes]
  );
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sede *</label>
      <SedeBuscador
        options={options}
        value={value}
        onChange={(nombre) => onChange((sedes || []).find(s => s.nombre === nombre))}
        placeholder="Elegir sede"
      />
      {options.length === 0 && (
        <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          No hay sedes cargadas. Contactá a un administrador.
        </p>
      )}
    </div>
  );
}