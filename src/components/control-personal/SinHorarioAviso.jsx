import React from 'react';
import { Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SinHorarioAviso({ onConfigurar, compacto = false }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 ${compacto ? 'px-3 py-2.5' : 'px-4 py-4'}`}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
          <Clock3 className="h-4.5 w-4.5 text-amber-400" />
        </div>
        <p className="text-sm text-amber-100/90">Cargá el horario del sector para ver llegadas tarde y ausencias</p>
      </div>
      {onConfigurar && (
        <Button size="sm" variant="outline" onClick={onConfigurar} className="border-amber-500/40 text-amber-300 hover:bg-amber-500/15 shrink-0">
          Configurar horario
        </Button>
      )}
    </div>
  );
}