import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const mostrar = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
};

export default function ArranqueRapidoDiferencias({ open, onOpenChange, diferencias = [] }) {
  const n = diferencias.length;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Arranque rápido: {n} diferencia{n !== 1 ? 's' : ''}</DialogTitle>
          <DialogDescription>
            En esos puntos se están usando los valores del arranque de siempre.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-popover text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Dato</th>
                <th className="text-left font-semibold px-3 py-2">Campo</th>
                <th className="text-left font-semibold px-3 py-2">De siempre</th>
                <th className="text-left font-semibold px-3 py-2">Rápido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {diferencias.slice(0, 300).map((d, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-muted-foreground">{d.item}</td>
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
  );
}