import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const mostrar = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  return String(v);
};

// Indicador solo para administradores: resultado de comparar el Panel rápido
// contra el cálculo de siempre.
export default function PanelRapidoEstado({ verificacion }) {
  const [open, setOpen] = useState(false);
  if (!verificacion || verificacion.estado === 'verificando') return null;

  if (verificacion.estado === 'ok') {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Panel rápido verificado ✓
      </p>
    );
  }

  if (verificacion.estado === 'error') {
    return <p className="text-[11px] text-muted-foreground">Panel rápido: no se pudo verificar</p>;
  }

  const n = verificacion.diferencias.length;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
      >
        <AlertTriangle className="h-3.5 w-3.5" /> Panel rápido: {n} diferencia{n !== 1 ? 's' : ''}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Panel rápido: {n} diferencia{n !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              En pantalla se están mostrando los valores del cálculo de siempre.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-popover text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Valor</th>
                  <th className="text-right font-semibold px-3 py-2">Viejo</th>
                  <th className="text-right font-semibold px-3 py-2">Nuevo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {verificacion.diferencias.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-foreground">{d.valor}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-400">{mostrar(d.viejo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-400">{mostrar(d.nuevo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}