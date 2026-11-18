import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const MAX_FILAS = 300;

const mostrar = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

// Indicador solo para administradores: resultado de comparar Órdenes rápidas
// contra el tablero de siempre.
export default function OrdenesRapidasEstado({ verificacion }) {
  const [open, setOpen] = useState(false);
  if (!verificacion || verificacion.estado === 'verificando') return null;

  if (verificacion.estado === 'ok') {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Órdenes rápidas verificadas ✓
      </p>
    );
  }

  if (verificacion.estado === 'error') {
    return <p className="text-[11px] text-muted-foreground">Órdenes rápidas: no se pudo verificar</p>;
  }

  const n = verificacion.diferencias.length;
  const titulo = `Órdenes rápidas: ${n} diferencia${n !== 1 ? 's' : ''}`;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
      >
        <AlertTriangle className="h-3.5 w-3.5" /> {titulo}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>
              En pantalla se están mostrando los datos de la consulta de siempre.
              {n > MAX_FILAS ? ` Se listan las primeras ${MAX_FILAS}.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-popover text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Id</th>
                  <th className="text-left font-semibold px-3 py-2">Campo</th>
                  <th className="text-left font-semibold px-3 py-2">Viejo</th>
                  <th className="text-left font-semibold px-3 py-2">Nuevo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {verificacion.diferencias.slice(0, MAX_FILAS).map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{d.id}</td>
                    <td className="px-3 py-2 text-foreground">{d.campo}</td>
                    <td className="px-3 py-2 text-emerald-400 break-all">{mostrar(d.viejo)}</td>
                    <td className="px-3 py-2 text-amber-400 break-all">{mostrar(d.nuevo)}</td>
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